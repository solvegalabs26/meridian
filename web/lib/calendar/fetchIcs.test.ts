/**
 * Test suite for SSRF-hardened ICS fetcher.
 *
 * Categories:
 *   1. assertIpAllowed — pure validator, no I/O
 *   2. assertUrlAllowed — pure validator, no I/O
 *   3. fetchIcsText — integration: DNS rebinding, redirects, limits, no-leak
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  assertIpAllowed,
  assertUrlAllowed,
  fetchIcsText,
  IcsFetchError,
  SAFE_MSG,
} from './fetchIcs'

// ─── 1. assertIpAllowed ───────────────────────────────────────────────────────

describe('assertIpAllowed — blocked IPv4 ranges', () => {
  const blocked = [
    '127.0.0.1',        // loopback
    '127.255.255.255',  // loopback top
    '10.0.0.1',         // RFC-1918
    '10.255.255.255',
    '172.16.0.1',       // RFC-1918
    '172.31.255.255',   // RFC-1918 top
    '192.168.0.1',      // RFC-1918
    '192.168.255.255',
    '169.254.0.1',      // link-local / IMDS
    '169.254.169.254',  // EC2/Azure IMDS
    '100.64.0.1',       // CGNAT start
    '100.127.255.255',  // CGNAT end
    '0.0.0.0',          // unspecified
  ]
  for (const ip of blocked) {
    it(`blocks ${ip}`, () => {
      expect(() => assertIpAllowed(ip)).toThrow(IcsFetchError)
      expect(() => assertIpAllowed(ip)).toThrow(SAFE_MSG)
    })
  }
})

describe('assertIpAllowed — allowed IPv4', () => {
  const allowed = [
    '8.8.8.8',
    '1.1.1.1',
    '172.15.255.255',  // just below 172.16/12
    '172.32.0.0',      // just above 172.31/12
    '100.63.255.255',  // just below CGNAT
    '100.128.0.0',     // just above CGNAT
  ]
  for (const ip of allowed) {
    it(`allows ${ip}`, () => {
      expect(() => assertIpAllowed(ip)).not.toThrow()
    })
  }
})

describe('assertIpAllowed — blocked IPv6', () => {
  const blocked = [
    '::1',                  // loopback
    '::',                   // unspecified
    'fc00::1',              // unique-local fc00::/7
    'fd12:3456::1',         // unique-local fd00::/7
    'fe80::1',              // link-local
    'febf::1',              // link-local top
    '::ffff:169.254.169.254', // IPv4-mapped link-local dotted
    '::ffff:a9fe:a9fe',       // IPv4-mapped link-local hex-group
    '::ffff:127.0.0.1',       // IPv4-mapped loopback dotted
    '::ffff:7f00:1',          // IPv4-mapped loopback hex-group
    '::ffff:10.0.0.1',        // IPv4-mapped private dotted
  ]
  for (const ip of blocked) {
    it(`blocks ${ip}`, () => {
      expect(() => assertIpAllowed(ip)).toThrow(IcsFetchError)
    })
  }
})

describe('assertIpAllowed — allowed IPv6', () => {
  const allowed = [
    '2001:4860:4860::8888',  // Google DNS IPv6
    '2606:4700:4700::1111',  // Cloudflare DNS IPv6
  ]
  for (const ip of allowed) {
    it(`allows ${ip}`, () => {
      expect(() => assertIpAllowed(ip)).not.toThrow()
    })
  }
})

// ─── 2. assertUrlAllowed ─────────────────────────────────────────────────────

describe('assertUrlAllowed — scheme enforcement', () => {
  it('rejects http://', () => {
    expect(() => assertUrlAllowed('http://example.com/feed.ics')).toThrow(IcsFetchError)
  })
  it('rejects ftp://', () => {
    expect(() => assertUrlAllowed('ftp://example.com/feed.ics')).toThrow(IcsFetchError)
  })
  it('accepts https://', () => {
    expect(() => assertUrlAllowed('https://example.com/feed.ics')).not.toThrow()
  })
  it('accepts webcal:// (rewritten to https)', () => {
    const url = assertUrlAllowed('webcal://example.com/feed.ics')
    expect(url.protocol).toBe('https:')
  })
  it('rejects malformed URL', () => {
    expect(() => assertUrlAllowed('not a url')).toThrow(IcsFetchError)
  })
})

describe('assertUrlAllowed — port enforcement', () => {
  it('accepts port 443 explicitly', () => {
    expect(() => assertUrlAllowed('https://example.com:443/feed.ics')).not.toThrow()
  })
  it('rejects port 8443', () => {
    expect(() => assertUrlAllowed('https://example.com:8443/feed.ics')).toThrow(IcsFetchError)
  })
  it('rejects port 80', () => {
    expect(() => assertUrlAllowed('https://example.com:80/feed.ics')).toThrow(IcsFetchError)
  })
})

describe('assertUrlAllowed — localhost and IP literals', () => {
  it('rejects localhost', () => {
    expect(() => assertUrlAllowed('https://localhost/feed.ics')).toThrow(IcsFetchError)
  })
  it('rejects 127.0.0.1 literal', () => {
    expect(() => assertUrlAllowed('https://127.0.0.1/feed.ics')).toThrow(IcsFetchError)
  })
  it('rejects 169.254.169.254 literal', () => {
    expect(() => assertUrlAllowed('https://169.254.169.254/feed.ics')).toThrow(IcsFetchError)
  })
  it('rejects 10.0.0.1 literal', () => {
    expect(() => assertUrlAllowed('https://10.0.0.1/feed.ics')).toThrow(IcsFetchError)
  })
  it('rejects [::1] literal (IPv6 loopback)', () => {
    expect(() => assertUrlAllowed('https://[::1]/feed.ics')).toThrow(IcsFetchError)
  })
})

describe('assertUrlAllowed — WHATWG normalises encoded IPv4 literals', () => {
  // WHATWG URL parser normalises these to dotted-quad for http/https schemes
  it('rejects decimal-integer form of 169.254.169.254 (2852039166)', () => {
    // new URL('https://2852039166/') → hostname = '169.254.169.254'
    expect(() => assertUrlAllowed('https://2852039166/feed.ics')).toThrow(IcsFetchError)
  })
  it('rejects hex form of 169.254.169.254 (0xa9fea9fe)', () => {
    expect(() => assertUrlAllowed('https://0xa9fea9fe/feed.ics')).toThrow(IcsFetchError)
  })
  it('rejects octal form of 169.254.169.254 (0251.0376.0251.0376)', () => {
    expect(() => assertUrlAllowed('https://0251.0376.0251.0376/feed.ics')).toThrow(IcsFetchError)
  })
})

describe('assertUrlAllowed — returns URL on success', () => {
  it('returns parsed URL for valid https input', () => {
    const url = assertUrlAllowed('https://cal.example.com/feed.ics?token=abc')
    expect(url).toBeInstanceOf(URL)
    expect(url.hostname).toBe('cal.example.com')
    expect(url.pathname).toBe('/feed.ics')
  })
})

// ─── 3. fetchIcsText — integration ───────────────────────────────────────────
//
// These tests mock node:dns/promises and node:https to exercise the full
// fetch path (including the agent-level pinning) without network I/O.
//
// vi.mock must be at the top scope and Vitest hoists them; this works in
// vitest because it uses the same hoisting behaviour as Jest for vi.mock.

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(),
}))

vi.mock('node:https', () => {
  // Agent must be a constructable function (arrow functions cannot be `new`-ed)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function MockAgent(this: any, _opts: unknown) { return this }
  return {
    default: {
      Agent: MockAgent,
      request: vi.fn(),
    },
  }
})

import { lookup as _dnsLookup } from 'node:dns/promises'
import _https from 'node:https'

const mockLookup = _dnsLookup as ReturnType<typeof vi.fn>
const mockRequest = _https.request as ReturnType<typeof vi.fn>

function makeRes(opts: {
  statusCode: number
  headers?: Record<string, string>
  body?: string
  errorAfterHeaders?: boolean
}) {
  const { EventEmitter } = require('node:events')
  const res = new EventEmitter() as NodeJS.ReadableStream & {
    statusCode: number
    headers: Record<string, string>
    destroy: () => void
  }
  res.statusCode = opts.statusCode
  res.headers = opts.headers ?? {}
  res.destroy = vi.fn()
  if (opts.body !== undefined && !opts.errorAfterHeaders) {
    process.nextTick(() => {
      res.emit('data', Buffer.from(opts.body as string))
      res.emit('end')
    })
  }
  if (opts.errorAfterHeaders) {
    process.nextTick(() => res.emit('error', new Error('stream error')))
  }
  return res
}

function makeReq() {
  const { EventEmitter } = require('node:events')
  const req = new EventEmitter() as {
    setTimeout: ReturnType<typeof vi.fn>
    destroy: ReturnType<typeof vi.fn>
    end: ReturnType<typeof vi.fn>
    emit: (event: string, ...args: unknown[]) => boolean
  }
  req.setTimeout = vi.fn()
  req.destroy = vi.fn()
  req.end = vi.fn()
  return req
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchIcsText — happy path', () => {
  it('returns body text for a valid public URL', async () => {
    mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    const req = makeReq()
    const res = makeRes({ statusCode: 200, body: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR' })
    mockRequest.mockImplementation((_opts: unknown, cb: (r: typeof res) => void) => {
      cb(res)
      return req
    })

    const result = await fetchIcsText('https://example.com/feed.ics')
    expect(result).toBe('BEGIN:VCALENDAR\r\nEND:VCALENDAR')
  })
})

describe('fetchIcsText — DNS rebinding prevention', () => {
  it('throws when DNS resolves to a private IP (would be rebinding target)', async () => {
    // This is the key test: DNS resolves to IMDS; must be caught in resolveAndPin
    mockLookup.mockResolvedValue([{ address: '169.254.169.254', family: 4 }])

    await expect(fetchIcsText('https://example.com/feed.ics')).rejects.toThrow(IcsFetchError)
    await expect(fetchIcsText('https://example.com/feed.ics')).rejects.toThrow(SAFE_MSG)
  })

  it('throws when DNS returns any mixed public+private addresses', async () => {
    mockLookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.1', family: 4 },  // private mixed in
    ])

    await expect(fetchIcsText('https://example.com/feed.ics')).rejects.toThrow(IcsFetchError)
  })

  it('never calls https.request when DNS resolves private', async () => {
    mockLookup.mockResolvedValue([{ address: '192.168.1.1', family: 4 }])

    await expect(fetchIcsText('https://example.com/feed.ics')).rejects.toThrow()
    expect(mockRequest).not.toHaveBeenCalled()
  })
})

describe('fetchIcsText — encoded IP literal shortcircuit (no DNS needed)', () => {
  it('throws on decimal integer IMDS address before DNS lookup', async () => {
    // 2852039166 === 169.254.169.254; assertUrlAllowed catches this pure — no DNS call
    await expect(fetchIcsText('https://2852039166/feed.ics')).rejects.toThrow(IcsFetchError)
    expect(mockLookup).not.toHaveBeenCalled()
  })

  it('throws on hex IMDS address before DNS lookup', async () => {
    await expect(fetchIcsText('https://0xa9fea9fe/feed.ics')).rejects.toThrow(IcsFetchError)
    expect(mockLookup).not.toHaveBeenCalled()
  })

  it('throws on octal IMDS address before DNS lookup', async () => {
    await expect(fetchIcsText('https://0251.0376.0251.0376/feed.ics')).rejects.toThrow(IcsFetchError)
    expect(mockLookup).not.toHaveBeenCalled()
  })
})

describe('fetchIcsText — redirect handling', () => {
  it('follows up to 2 redirects', async () => {
    mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])

    const req1 = makeReq()
    const req2 = makeReq()
    const res1 = makeRes({ statusCode: 301, headers: { location: 'https://example.com/redirected.ics' } })
    const res2 = makeRes({ statusCode: 200, body: 'BEGIN:VCALENDAR' })

    let callCount = 0
    mockRequest.mockImplementation((_opts: unknown, cb: (r: typeof res1 | typeof res2) => void) => {
      callCount++
      if (callCount === 1) { cb(res1); return req1 }
      cb(res2); return req2
    })

    const result = await fetchIcsText('https://example.com/feed.ics')
    expect(result).toBe('BEGIN:VCALENDAR')
    expect(mockRequest).toHaveBeenCalledTimes(2)
  })

  it('throws after exceeding 2 redirects', async () => {
    mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])

    let callCount = 0
    mockRequest.mockImplementation((_opts: unknown, cb: (r: ReturnType<typeof makeRes>) => void) => {
      callCount++
      const r = makeRes({ statusCode: 301, headers: { location: 'https://example.com/feed.ics' } })
      cb(r)
      return makeReq()
    })

    await expect(fetchIcsText('https://example.com/feed.ics')).rejects.toThrow(IcsFetchError)
  })

  it('re-validates redirect target URL (blocks redirect to private IP)', async () => {
    mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])

    const req = makeReq()
    const res = makeRes({ statusCode: 301, headers: { location: 'https://169.254.169.254/creds' } })
    mockRequest.mockImplementation((_opts: unknown, cb: (r: typeof res) => void) => {
      cb(res); return req
    })

    await expect(fetchIcsText('https://example.com/feed.ics')).rejects.toThrow(IcsFetchError)
  })
})

describe('fetchIcsText — body size limit', () => {
  it('throws when response body exceeds 2 MB', async () => {
    mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])

    const { EventEmitter } = await import('node:events')
    const res = new EventEmitter() as ReturnType<typeof makeRes>
    res.statusCode = 200
    res.headers = {}
    res.destroy = vi.fn()

    const req = makeReq()
    mockRequest.mockImplementation((_opts: unknown, cb: (r: typeof res) => void) => {
      cb(res); return req
    })

    // Emit chunks totaling just over 2 MB
    process.nextTick(() => {
      const chunkSize = 512 * 1024 // 512 KB
      for (let i = 0; i < 5; i++) { // 5 × 512 KB = 2.5 MB
        res.emit('data', Buffer.alloc(chunkSize))
      }
      res.emit('end')
    })

    await expect(fetchIcsText('https://example.com/feed.ics')).rejects.toThrow(IcsFetchError)
  })
})

describe('fetchIcsText — no-leak assertions', () => {
  it('error message does not contain the URL', async () => {
    mockLookup.mockResolvedValue([{ address: '169.254.169.254', family: 4 }])

    const secret = 'https://example.com/secret-token-12345/feed.ics'
    let thrown: Error | undefined
    try {
      await fetchIcsText(secret)
    } catch (e) {
      thrown = e as Error
    }

    expect(thrown).toBeInstanceOf(IcsFetchError)
    expect(thrown?.message).not.toContain('secret-token-12345')
    expect(thrown?.message).toBe(SAFE_MSG)
  })

  it('error message does not contain internal DNS error details', async () => {
    mockLookup.mockRejectedValue(new Error('ENOTFOUND internal-host.corp.example.com'))

    let thrown: Error | undefined
    try {
      await fetchIcsText('https://internal-host.corp.example.com/feed.ics')
    } catch (e) {
      thrown = e as Error
    }

    expect(thrown).toBeInstanceOf(IcsFetchError)
    expect(thrown?.message).not.toContain('ENOTFOUND')
    expect(thrown?.message).not.toContain('internal-host.corp.example.com')
    expect(thrown?.message).toBe(SAFE_MSG)
  })

  it('error message does not contain the pinned IP on HTTPS failure', async () => {
    mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])

    const req = makeReq()
    mockRequest.mockImplementation(() => {
      process.nextTick(() => req.emit('error', new Error('Connection refused to 93.184.216.34:443')))
      return req
    })

    let thrown: Error | undefined
    try {
      await fetchIcsText('https://example.com/feed.ics')
    } catch (e) {
      thrown = e as Error
    }

    expect(thrown).toBeInstanceOf(IcsFetchError)
    expect(thrown?.message).not.toContain('93.184.216.34')
    expect(thrown?.message).toBe(SAFE_MSG)
  })
})

describe('fetchIcsText — non-200 status codes', () => {
  it('throws on 404', async () => {
    mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    const req = makeReq()
    const res = makeRes({ statusCode: 404 })
    mockRequest.mockImplementation((_opts: unknown, cb: (r: typeof res) => void) => {
      cb(res); return req
    })
    // 404 is non-3xx non-2xx → throw; but there's no body emitted so end won't fire
    // Emit end anyway to resolve the promise
    process.nextTick(() => res.emit('end'))
    await expect(fetchIcsText('https://example.com/feed.ics')).rejects.toThrow(IcsFetchError)
  })

  it('throws on 500', async () => {
    mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    const req = makeReq()
    const res = makeRes({ statusCode: 500, body: '' })
    mockRequest.mockImplementation((_opts: unknown, cb: (r: typeof res) => void) => {
      cb(res); return req
    })
    await expect(fetchIcsText('https://example.com/feed.ics')).rejects.toThrow(IcsFetchError)
  })
})
