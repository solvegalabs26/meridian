'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import MeridianArcWordmark from '@/components/brand/MeridianArcWordmark'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
    })

    setLoading(false)

    // Don't leak whether an account exists for this email — Supabase itself
    // doesn't distinguish "no such user" from success here, so any error
    // that comes back is a real failure (network, rate limit), not enumeration.
    if (resetError) {
      setError('Something went wrong sending the reset link — please try again.')
      return
    }

    setSent(true)
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 flex flex-col items-center">
          <MeridianArcWordmark size="md" showSub={true} orientation="stacked" />
          <p className="text-[12px] text-white/40 mt-2">The home screen of your life</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-xl">
          {sent ? (
            <>
              <h2 className="text-[16px] font-semibold text-[var(--text)] mb-3">Check your email</h2>
              <p className="text-[13px] text-[var(--text2)] leading-relaxed">
                If an account exists for that email, we&apos;ve sent a reset link.
              </p>
              <Link href="/login" className="block mt-6 text-[13px] text-[var(--blue)] hover:underline">
                Back to sign in
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-[16px] font-semibold text-[var(--text)] mb-2">Reset your password</h2>
              <p className="text-[13px] text-[var(--text2)] mb-5">
                Enter your email and we&apos;ll send you a link to reset your password.
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-[var(--red-lt)] border border-[var(--red)]/20 text-[13px] text-[var(--red)]">
                  {error}
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    className="block mt-1 font-medium underline"
                  >
                    Try again
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--text2)] mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-[14px] text-[var(--text)] focus:outline-none focus:border-[var(--blue)] transition-colors"
                    placeholder="you@example.com"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg bg-navy text-white text-[14px] font-medium hover:bg-[var(--night)] transition-colors disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send reset link'}
                </button>
              </form>

              <p className="text-center text-[12px] text-[var(--text3)] mt-5">
                <Link href="/login" className="text-[var(--blue)] hover:underline">
                  Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
