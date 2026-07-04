import { lookup } from 'dns/promises'

export class IcsFetchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IcsFetchError'
  }
}

const SAFE_MSG = 'Calendar URL is not reachable or not allowed'

function isPrivateIPv4(parts: number[]): boolean {
  if (parts[0] === 127) return true                                           // 127.0.0.0/8 loopback
  if (parts[0] === 10) return true                                            // 10.0.0.0/8
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true      // 172.16.0.0/12
  if (parts[0] === 192 && parts[1] === 168) return true                       // 192.168.0.0/16
  if (parts[0] === 169 && parts[1] === 254) return true                       // 169.254.0.0/16 link-local + cloud metadata
  if (parts[0] === 0) return true                                             // 0.0.0.0/8
  return false
}

function isPrivateIP(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length === 4 && parts.every(p => !isNaN(p) && p >= 0 && p <= 255)) {
    return isPrivateIPv4(parts)
  }
  // IPv6
  const lower = ip.toLowerCase()
  if (lower === '::1') return true                                // loopback
  if (/^f[cd][0-9a-f]{2}:/i.test(lower)) return true            // fc00::/7 private
  if (/^fe[89ab][0-9a-f]:/i.test(lower)) return true            // fe80::/10 link-local
  if (lower.startsWith('::ffff:')) {                             // IPv4-mapped
    const mapped = lower.slice(7).split('.').map(Number)
    if (mapped.length === 4 && mapped.every(p => !isNaN(p))) return isPrivateIPv4(mapped)
  }
  return false
}

async function validateAndNormalizeUrl(raw: string): Promise<string> {
  // Rewrite webcal:// to https:// — the one allowed normalization
  const normalized = raw.replace(/^webcal:\/\//i, 'https://')

  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch {
    throw new IcsFetchError(SAFE_MSG)
  }

  if (parsed.protocol !== 'https:') throw new IcsFetchError(SAFE_MSG)
  if (parsed.hostname.toLowerCase() === 'localhost') throw new IcsFetchError(SAFE_MSG)

  const port = parsed.port || '443'
  if (port !== '443') throw new IcsFetchError(SAFE_MSG)

  let addresses: string[]
  try {
    const results = await lookup(parsed.hostname, { all: true })
    addresses = results.map(r => r.address)
  } catch {
    throw new IcsFetchError(SAFE_MSG)
  }

  if (addresses.length === 0) throw new IcsFetchError(SAFE_MSG)

  for (const addr of addresses) {
    if (isPrivateIP(addr)) throw new IcsFetchError(SAFE_MSG)
  }

  return normalized
}

export async function fetchIcsText(url: string): Promise<string> {
  let currentUrl = await validateAndNormalizeUrl(url)
  let redirectCount = 0

  while (true) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)

    let res: Response
    try {
      res = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: { 'User-Agent': 'MeridianArc/1.0 (calendar-sync)' },
        cache: 'no-store',
      })
    } catch {
      clearTimeout(timer)
      throw new IcsFetchError(SAFE_MSG)
    }
    clearTimeout(timer)

    // Handle redirects — re-validate each hop
    if (res.status >= 300 && res.status < 400) {
      if (redirectCount >= 2) throw new IcsFetchError(SAFE_MSG)
      const location = res.headers.get('location')
      if (!location) throw new IcsFetchError(SAFE_MSG)
      const redirectTarget = new URL(location, currentUrl).toString()
      currentUrl = await validateAndNormalizeUrl(redirectTarget)
      redirectCount++
      continue
    }

    if (!res.ok) throw new IcsFetchError(SAFE_MSG)
    if (!res.body) throw new IcsFetchError(SAFE_MSG)

    // Stream body with 2 MB cap
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let totalBytes = 0
    const MAX_BYTES = 2 * 1024 * 1024

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        totalBytes += value.length
        if (totalBytes > MAX_BYTES) {
          reader.cancel()
          throw new IcsFetchError(SAFE_MSG)
        }
        chunks.push(value)
      }
    } catch (err) {
      if (err instanceof IcsFetchError) throw err
      throw new IcsFetchError(SAFE_MSG)
    }

    const combined = new Uint8Array(totalBytes)
    let offset = 0
    for (const chunk of chunks) {
      combined.set(chunk, offset)
      offset += chunk.length
    }
    return new TextDecoder('utf-8').decode(combined)
  }
}
