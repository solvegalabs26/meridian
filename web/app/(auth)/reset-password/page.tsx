'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import MeridianArcWordmark from '@/components/brand/MeridianArcWordmark'

type SessionState = 'checking' | 'valid' | 'invalid'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [sessionState, setSessionState] = useState<SessionState>('checking')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    // Supabase redirects expired/invalid recovery links back with error
    // params rather than a code — no session will ever be established.
    const params = new URLSearchParams(window.location.search)
    if (params.get('error')) {
      setSessionState('invalid')
      return
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionState('valid')
      }
    })

    // The PASSWORD_RECOVERY event fires once, during the client's initial
    // exchange of the recovery code in the URL — it may have already fired
    // by the time this listener attaches. Fall back to checking for an
    // established session directly.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionState(current => (current === 'checking' && session ? 'valid' : current))
    })

    const timeout = setTimeout(() => {
      setSessionState(current => (current === 'checking' ? 'invalid' : current))
    }, 4000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    setError(null)

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setDone(true)
    setTimeout(() => {
      router.push('/dashboard')
      router.refresh()
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 flex flex-col items-center">
          <MeridianArcWordmark size="md" showSub={true} orientation="stacked" />
          <p className="text-[12px] text-white/40 mt-2">The home screen of your life</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-xl">
          {sessionState === 'checking' && (
            <p className="text-[13px] text-[var(--text2)] text-center py-4">Verifying your reset link...</p>
          )}

          {sessionState === 'invalid' && (
            <>
              <h2 className="text-[16px] font-semibold text-[var(--text)] mb-2">Link expired</h2>
              <p className="text-[13px] text-[var(--text2)] leading-relaxed mb-4">
                This reset link is invalid or has expired.
              </p>
              <Link href="/forgot-password" className="text-[13px] text-[var(--blue)] hover:underline font-medium">
                Request a new one
              </Link>
            </>
          )}

          {sessionState === 'valid' && done && (
            <p className="text-[13px] text-[var(--text2)] text-center py-4">
              Password updated — taking you to your dashboard...
            </p>
          )}

          {sessionState === 'valid' && !done && (
            <>
              <h2 className="text-[16px] font-semibold text-[var(--text)] mb-5">Set a new password</h2>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-[var(--red-lt)] border border-[var(--red)]/20 text-[13px] text-[var(--red)]">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--text2)] mb-1">New password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className="w-full px-3 py-2.5 pr-10 rounded-lg border border-[var(--border)] text-[14px] text-[var(--text)] focus:outline-none focus:border-[var(--blue)] transition-colors"
                      placeholder="Min. 8 characters"
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
                <div>
                  <label className="block text-[12px] font-medium text-[var(--text2)] mb-1">Confirm password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-[14px] text-[var(--text)] focus:outline-none focus:border-[var(--blue)] transition-colors"
                    placeholder="Re-enter password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || password.length < 8}
                  className="w-full py-2.5 rounded-lg bg-navy text-white text-[14px] font-medium hover:bg-[var(--night)] transition-colors disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
