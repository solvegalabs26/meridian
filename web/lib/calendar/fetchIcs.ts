/**
 * SSRF-hardened ICS fetcher.
 *
 * Architecture:
 *   assertUrlAllowed / assertIpAllowed — pure validators, no I/O, fully unit-testable.
 *   fetchIcsText — resolves DNS once, pins the validated IP into a custom https.Agent
 *     lookup, so the transport layer never re-resolves the hostname.
 *     This closes the DNS-rebinding window that exists when fetch() (undici) performs
 *     its own independent resolution after a separate dns.lookup validation pass.
 */

import { lookup as dnsLookup } from 'node:dns/promises'
import https from 'node:https'
import { isIPv4 } from 'node:net'

// ─── Error ──────────────────────────────────────────────────────────────────

export class IcsFetchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IcsFetchError'
  }
}

export const SAFE_MSG = 'Calendar URL is not reachable or not allowed'

// ─── Pure validator helpers ──────────────────────────────────────────────────

function assertIPv4Parts(dotted: string): void {
  const parts = dotted.split('.').map(Number)
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    throw new IcsFetchError(SAFE_MSG)
  }
  const [a, b] = parts
  if (a === 127) throw new IcsFetchError(SAFE_MSG)                            // 127.0.0.0/8 loopback
  if (a === 10) throw new IcsFetchError(SAFE_MSG)                             // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) throw new IcsFetchError(SAFE_MSG)     // 172.16.0.0/12
  if (a === 192 && b === 168) throw new IcsFetchError(SAFE_MSG)               // 192.168.0.0/16
  if (a === 169 && b === 254) throw new IcsFetchError(SAFE_MSG)               // 169.254.0.0/16 link-local + cloud metadata
  if (a === 100 && b >= 64 && b <= 127) throw new IcsFetchError(SAFE_MSG)    // 100.64.0.0/10 CGNAT
  if (a === 0) throw new IcsFetchError(SAFE_MSG)                              // 0.0.0.0/8 unspecified
}

/**
 * Throws IcsFetchError if `ip` (a resolved address string) is in any blocked range.
 * Handles standard dotted-quad IPv4 and all IPv6 forms including IPv4-mapped.
 * Input must be a resolved address (dotted-quad, full/compressed IPv6) — not a hostname.
 */
export function assertIpAllowed(ip: string): void {
  const lower = ip.toLowerCase()

  if (!lower.includes(':')) {
    // IPv4 dotted-quad (Node's dns.lookup and URL parser always return this form)
    assertIPv4Parts(lower)
    return
  }

  // ── IPv6 ──
  if (lower === '::1') throw new IcsFetchError(SAFE_MSG)          // loopback
  if (lower === '::') throw new IcsFetchError(SAFE_MSG)           // unspecified

  // fc00::/7 unique-local (fc00:: and fd00:: prefixes)
  if (/^f[cd][0-9a-f]{2}:/i.test(lower)) throw new IcsFetchError(SAFE_MSG)

  // fe80::/10 link-local (fe80–febf)
  if (/^fe[89ab][0-9a-f]:/i.test(lower)) throw new IcsFetchError(SAFE_MSG)

  // IPv4-mapped ::ffff:a.b.c.d  OR  ::ffff:aabb:ccdd
  if (lower.startsWith('::ffff:')) {
    const rest = lower.slice(7)
    if (rest.includes('.')) {
      // Dotted notation — unwrap directly
      assertIPv4Parts(rest)
    } else if (rest.includes(':')) {
      // Hex-group notation e.g. a9fe:a9fe → 169.254.169.254
      const groups = rest.split(':')
      if (groups.length === 2) {
        const hi = parseInt(groups[0], 16)
        const lo = parseInt(groups[1], 16)
        if (!isNaN(hi) && !isNaN(lo)) {
          assertIPv4Parts(
            `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`
          )
        }
      }
    }
  }
}

/**
 * Validates that `rawUrl` is a safe HTTPS URL to fetch.
 * Rewrites webcal:// → https:// (the one allowed normalization).
 * Throws IcsFetchError on any violation.
 * Returns the parsed URL on success.
 *
 * Pure — no I/O. The WHATWG URL parser normalises encoded IPv4 literals
 * (decimal-integer, hex, octal) to dotted-quad, so this catches all forms.
 */
export function assertUrlAllowed(rawUrl: string): URL {
  const normalized = rawUrl.replace(/^webcal:\/\//i, 'https://')

  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch {
    throw new IcsFetchError(SAFE_MSG)
  }

  if (parsed.protocol !== 'https:') throw new IcsFetchError(SAFE_MSG)

  // Port must be the HTTPS default (empty after WHATWG normalisation) or explicitly 443
  const port = parsed.port
  if (port !== '' && port !== '443') throw new IcsFetchError(SAFE_MSG)

  const host = parsed.hostname.toLowerCase()
  if (host === 'localhost') throw new IcsFetchError(SAFE_MSG)

  // If hostname is an IP literal, range-check it immediately.
  // IPv4: WHATWG normalises decimal/hex/octal to dotted-quad.
  // IPv6: WHATWG .hostname keeps brackets, e.g. [::1]; strip before checking.
  if (isIPv4(host)) {
    assertIpAllowed(host)
  } else if (host.startsWith('[') && host.endsWith(']')) {
    assertIpAllowed(host.slice(1, -1))
  }

  return parsed
}

// ─── DNS resolution + pinning ────────────────────────────────────────────────

async function resolveAndPin(
  hostname: string
): Promise<{ ip: string; family: 4 | 6 }> {
  let addresses: Array<{ address: string; family: number }>
  try {
    addresses = await dnsLookup(hostname, { all: true })
  } catch {
    throw new IcsFetchError(SAFE_MSG)
  }

  if (!addresses || addresses.length === 0) throw new IcsFetchError(SAFE_MSG)

  // Reject if ANY resolved address is in a blocked range.
  // A host resolving to both public and private IPs is a rebinding signal.
  for (const { address } of addresses) {
    assertIpAllowed(address)
  }

  const { address, family } = addresses[0]
  return { ip: address, family: family as 4 | 6 }
}

// ─── Pinning HTTPS fetcher ────────────────────────────────────────────────────

interface RawResponse {
  statusCode: number
  headers: Record<string, string | string[] | undefined>
  body: Buffer | null
}

function httpsGetRaw(
  url: URL,
  pinnedIp: string,
  family: 4 | 6,
  timeoutMs: number
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    // The agent's lookup always returns the pre-validated pinned IP regardless
    // of what hostname the transport layer asks about — this is what closes
    // the DNS rebinding window.
    const agent = new https.Agent({
      lookup: (_hostname, _opts, cb) => cb(null, pinnedIp, family),
    })

    const path = (url.pathname || '/') + (url.search || '')

    const req = https.request(
      {
        hostname: url.hostname, // used for Host header + TLS SNI
        port: 443,
        path,
        method: 'GET',
        headers: {
          'Host': url.hostname,
          'User-Agent': 'MeridianArc/1.0 (calendar-sync)',
        },
        agent,
        servername: url.hostname, // explicit TLS SNI for clarity
      },
      (res) => {
        const statusCode = res.statusCode ?? 0
        const headers = res.headers as Record<string, string | string[] | undefined>

        // Don't buffer 3xx bodies — just return headers for redirect handling
        if (statusCode >= 300 && statusCode < 400) {
          res.destroy()
          resolve({ statusCode, headers, body: null })
          return
        }

        const chunks: Buffer[] = []
        let totalBytes = 0
        const MAX_BYTES = 2 * 1024 * 1024 // 2 MB

        res.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length
          if (totalBytes > MAX_BYTES) {
            res.destroy()
            reject(new IcsFetchError(SAFE_MSG))
          } else {
            chunks.push(chunk)
          }
        })

        res.on('end', () => resolve({ statusCode, headers, body: Buffer.concat(chunks) }))
        res.on('error', () => reject(new IcsFetchError(SAFE_MSG)))
      }
    )

    req.setTimeout(timeoutMs, () => {
      req.destroy()
      reject(new IcsFetchError(SAFE_MSG))
    })

    req.on('error', () => reject(new IcsFetchError(SAFE_MSG)))
    req.end()
  })
}

// ─── Public entry point ───────────────────────────────────────────────────────

const MAX_REDIRECTS = 2
const TIMEOUT_MS = 8_000

export async function fetchIcsText(url: string): Promise<string> {
  let currentUrl = assertUrlAllowed(url) // throws synchronously on bad input
  let redirectCount = 0

  while (true) {
    // Resolve once → validate all returned addresses → pin the first
    const { ip, family } = await resolveAndPin(currentUrl.hostname)

    const { statusCode, headers, body } = await httpsGetRaw(
      currentUrl,
      ip,
      family,
      TIMEOUT_MS
    )

    if (statusCode >= 300 && statusCode < 400) {
      if (redirectCount >= MAX_REDIRECTS) throw new IcsFetchError(SAFE_MSG)
      const loc = headers['location']
      const locStr = Array.isArray(loc) ? loc[0] : loc
      if (!locStr) throw new IcsFetchError(SAFE_MSG)
      // Full re-validation on each redirect target (SSRF via redirect)
      currentUrl = assertUrlAllowed(new URL(locStr, currentUrl.toString()).toString())
      redirectCount++
      continue
    }

    if (statusCode < 200 || statusCode >= 300) throw new IcsFetchError(SAFE_MSG)
    if (!body) throw new IcsFetchError(SAFE_MSG)

    return body.toString('utf-8')
  }
}
