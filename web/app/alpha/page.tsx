'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import MeridianArcWordmark from '@/components/brand/MeridianArcWordmark'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'

type Phase = 'code' | 'account' | 'redeem_error'
type CodeStatus = 'valid' | 'invalid' | 'already_used' | 'expired'

const CODE_ERRORS: Record<Exclude<CodeStatus, 'valid'>, string> = {
  invalid: "That code isn't valid. Check your invitation email and try again.",
  already_used: 'That code has already been used.',
  expired: 'That code has expired. Please contact support.',
}

const REDEMPTION_ERRORS: Record<string, string> = {
  invalid_code: "That invite code isn't valid. Double-check it and try again.",
  code_already_used: 'That invite code has already been used.',
  code_expired: 'That invite code has expired.',
}

export default function AlphaEntryPage() {
  const router = useRouter()
  const supabase = createClient()

  const [phase, setPhase] = useState<Phase>('code')
  const [code, setCode] = useState('')

  // Stage 1 state
  const [codeError, setCodeError] = useState<string | null>(null)
  const [validating, setValidating] = useState(false)

  // Stage 2 / account creation state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountExists, setAccountExists] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingLabel, setLoadingLabel] = useState('Creating account...')
  // Honeypot — bots fill hidden fields, humans don't
  const [honeypot, setHoneypot] = useState('')

  // Redirect already-authenticated users straight to dashboard
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace('/dashboard')
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Stage 1 — lightweight pre-validation before account creation.
  // Uses a server route (service role) because invite_codes has no
  // public RLS policies and cannot be read by anon/authenticated clients.
  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    const normalized = code.trim().toUpperCase()
    if (!normalized) return

    setValidating(true)
    setCodeError(null)

    const res = await fetch('/api/invites/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: normalized }),
    })
    const data = await res.json() as { status: CodeStatus }
    setValidating(false)

    if (data.status === 'valid') {
      setCode(normalized)
      setPhase('account')
    } else {
      setCodeError(CODE_ERRORS[data.status] ?? CODE_ERRORS.invalid)
    }
  }

  // Stage 2b — atomic redemption via SECURITY DEFINER RPC. Called right
  // after signup succeeds, and again from the retry form if a code was
  // wrong — reusing the same (now-authenticated) account rather than
  // signing up again, so a typo doesn't leave behind orphaned auth accounts.
  async function redeemCode() {
    setLoading(true)
    setLoadingLabel('Checking your code...')
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Something went wrong — please try signing in again.')
      setLoading(false)
      return
    }

    const { data, error: rpcError } = await supabase.rpc('redeem_invite_code', {
      p_code: code.trim(),
      p_user_id: user.id,
    })

    setLoading(false)

    if (rpcError || !data?.success) {
      const key = data?.error as string | undefined
      setError(REDEMPTION_ERRORS[key ?? ''] ?? 'Something went wrong redeeming your code — please try again.')
      setPhase('redeem_error')
      return
    }

    if (data.requires_idme) {
      router.push('/alpha/verify-idme')
      return
    }

    router.push('/alpha/welcome')
  }

  // Stage 2a — create the auth account, then immediately redeem the code.
  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    if (honeypot) return // silent bot block
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    setLoadingLabel('Creating account...')
    setError(null)
    setAccountExists(false)

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (signUpError) {
      if (signUpError.message.toLowerCase().includes('already registered')) {
        setAccountExists(true)
      } else {
        setError(signUpError.message)
      }
      setLoading(false)
      return
    }

    // Account created — atomically claim the invite code before proceeding
    await redeemCode()
  }

  // ── Phase 1: Code entry ───────────────────────────────────────
  if (phase === 'code') {
    return (
      <div className="min-h-screen bg-navy flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8 flex flex-col items-center">
            <MeridianArcWordmark size="lg" showSub={true} animate={true} launchSequence={true} orientation="stacked" />
            <p className="text-[13px] text-white/40 mt-2">The home screen of your life</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-xl">
            <p className="text-[11px] text-[var(--text3)] uppercase tracking-widest font-semibold mb-1">Step 1 of 6</p>
            <h2 className="text-[18px] font-medium text-[var(--text)] mb-1">Enter your invite code</h2>
            <p className="text-[13px] text-[var(--text3)] mb-5">
              Check your invitation email for your personal alpha access code.
            </p>

            {codeError && (
              <div className="mb-4 p-3 rounded-lg bg-[var(--red-lt)] text-[var(--red)] text-[13px]">
                {codeError}
              </div>
            )}

            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1.5">
                  Invite code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={e => {
                    setCode(e.target.value.toUpperCase().trimStart())
                    setCodeError(null)
                  }}
                  required
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="ALPHA-XXXXXX"
                  className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-[14px] text-[var(--text)] font-mono tracking-wider focus:outline-none focus:border-[var(--blue)] transition-colors uppercase"
                />
              </div>

              <button
                type="submit"
                disabled={validating || !code.trim()}
                className="w-full py-2.5 rounded-lg bg-navy text-white text-[14px] font-medium hover:bg-[var(--night)] disabled:opacity-50 transition-colors"
              >
                {validating ? 'Checking...' : 'Continue →'}
              </button>
            </form>

            <p className="text-center text-[12px] text-[var(--text3)] mt-5">
              Already have an account?{' '}
              <Link href="/login" className="text-[var(--blue)] hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Phase 2: Account creation, or retrying a rejected code ───
  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 flex flex-col items-center">
          <MeridianArcWordmark size="lg" showSub={true} animate={true} launchSequence={true} orientation="stacked" />
          <p className="text-[13px] text-white/40 mt-2">The home screen of your life</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-xl">
          <p className="text-[11px] text-[var(--text3)] uppercase tracking-widest font-semibold mb-1">Step 2 of 6</p>
          <h2 className="text-[18px] font-medium text-[var(--text)] mb-5">
            {phase === 'redeem_error' ? 'Invite code' : 'Create your account'}
          </h2>

          {accountExists && (
            <div className="mb-4 p-3 rounded-lg bg-[var(--red-lt)] text-[var(--red)] text-[13px]">
              Account exists —{' '}
              <Link href="/login" className="underline font-medium">
                sign in instead
              </Link>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-[var(--red-lt)] text-[var(--red)] text-[13px]">{error}</div>
          )}

          {phase === 'redeem_error' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1.5">
                  Invite code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase().trimStart())}
                  autoComplete="off"
                  className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-[14px] text-[var(--text)] font-mono tracking-wider focus:outline-none focus:border-[var(--blue)] transition-colors uppercase"
                />
              </div>
              <button
                onClick={redeemCode}
                disabled={loading || !code.trim()}
                className="w-full py-2.5 rounded-lg bg-navy text-white text-[14px] font-medium hover:bg-[var(--night)] disabled:opacity-50 transition-colors"
              >
                {loading ? loadingLabel : 'Try again →'}
              </button>
            </div>
          ) : (
            <>
              {/* Honeypot — hidden from humans, bots fill it */}
              <input
                type="text"
                name="website"
                value={honeypot}
                onChange={e => setHoneypot(e.target.value)}
                autoComplete="off"
                tabIndex={-1}
                aria-hidden="true"
                style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, width: 0 }}
              />

              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-[14px] text-[var(--text)] focus:outline-none focus:border-[var(--blue)] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="Min. 8 characters"
                      className="w-full px-3 py-2.5 pr-10 rounded-lg border border-[var(--border)] text-[14px] text-[var(--text)] focus:outline-none focus:border-[var(--blue)] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--blue)]"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !email.trim() || password.length < 8}
                  className="w-full py-2.5 rounded-lg bg-navy text-white text-[14px] font-medium hover:bg-[var(--night)] disabled:opacity-50 transition-colors"
                >
                  {loading ? loadingLabel : 'Create account →'}
                </button>
              </form>
            </>
          )}

          <p className="text-center text-[12px] text-[var(--text3)] mt-5">
            Already have an account?{' '}
            <Link href="/login" className="text-[var(--blue)] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
