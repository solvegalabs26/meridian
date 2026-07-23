// app/auth/callback/route.ts
//
// Meridian Arc — auth callback (security hardening pass, Jul 23 2026)
//
// Changes from previous version:
//   1. `next` param validated — same-origin relative paths only        (T1)
//   2. `type` validated against an allowlist instead of a bare cast    (T2)
//   3. Enterprise users routed to /enterprise, not /dashboard          (T3)
//   4. Invited users sent to set a password before landing             (T4)
//
// Unchanged: createClient wrapper, dual code/token_hash branches,
// recovery → /reset-password, error redirect target.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// T2: runtime-validated OTP types. The previous `as` cast was erased at
// compile time, so an attacker-supplied value reached verifyOtp unchecked.
// 'invite' added — that is the type Supabase sends on dashboard invites.
// ---------------------------------------------------------------------------
const VALID_OTP_TYPES = [
  'recovery',
  'signup',
  'magiclink',
  'invite',
  'email_change',
] as const

type OtpType = (typeof VALID_OTP_TYPES)[number]

function parseOtpType(raw: string | null): OtpType | null {
  return VALID_OTP_TYPES.includes(raw as OtpType) ? (raw as OtpType) : null
}

// ---------------------------------------------------------------------------
// T1: `next` validation.
//
// The bug: new URL(next, origin) lets an absolute or protocol-relative value
// override the base entirely. "https://evil.com" and "//evil.com" both
// resolve off-site. Rule is now: rooted relative paths on our origin, or
// nothing.
// ---------------------------------------------------------------------------
const MAX_NEXT_LENGTH = 512

function safeNext(raw: string | null, origin: string): string | null {
  if (!raw || raw.length > MAX_NEXT_LENGTH) return null

  // Decode repeatedly (bounded) so layered encoding can't smuggle a
  // separator past the checks below — %2F%2Fevil.com decodes to //evil.com.
  let value = raw
  for (let i = 0; i < 3; i++) {
    let decoded: string
    try {
      decoded = decodeURIComponent(value)
    } catch {
      return null // malformed percent-encoding
    }
    if (decoded === value) break
    value = decoded
  }

  // Control characters and whitespace: some parsers strip these before
  // resolving, so "/\tevil.com" can become "/evil.com" downstream.
  if (/[\u0000-\u001F\u007F\s]/.test(value)) return null

  if (!value.startsWith('/')) return null
  if (value.startsWith('//') || value.startsWith('/\\')) return null
  if (value.includes('\\')) return null
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return null

  try {
    const resolved = new URL(value, origin)
    if (resolved.origin !== new URL(origin).origin) return null
    return resolved.pathname + resolved.search + resolved.hash
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// T3: tier-aware landing. Middleware walls enterprise_only users to
// /enterprise/*; sending them to /dashboard guarantees an extra redirect on
// first login. enterprise_only lives on app_metadata (service-role writable
// only) — never trust user_metadata for this.
// ---------------------------------------------------------------------------
const ENTERPRISE_HOME = '/enterprise'
const PERSONAL_HOME = '/dashboard'

function isEnterprisePath(path: string): boolean {
  return path === ENTERPRISE_HOME || path.startsWith(`${ENTERPRISE_HOME}/`)
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const { searchParams, origin } = requestUrl
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = parseOtpType(searchParams.get('type'))

  const fail = () =>
    NextResponse.redirect(new URL('/login?error=auth_callback_failed', origin))

  const supabase = createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return fail()
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (error) return fail()
  } else {
    return fail()
  }

  // Password-setting flows terminate here regardless of `next`.
  // T4: invited users have no password yet — Darren included.
  if (type === 'recovery' || type === 'invite') {
    return NextResponse.redirect(new URL('/reset-password', origin))
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return fail()

  const isEnterprise = user.app_metadata?.enterprise_only === true
  const defaultHome = isEnterprise ? ENTERPRISE_HOME : PERSONAL_HOME

  let target = safeNext(searchParams.get('next'), origin) ?? defaultHome

  // Don't hand a personal user an enterprise path or vice versa — middleware
  // is the enforcement layer, this just avoids the bounce.
  if (isEnterprise !== isEnterprisePath(target)) {
    target = defaultHome
  }

  return NextResponse.redirect(new URL(target, origin))
}
