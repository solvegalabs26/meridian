'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import MeridianBeacon from '@/components/brand/MeridianBeacon'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'

export default function OnboardingCreateAccountPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountExists, setAccountExists] = useState(false)
  const [loading, setLoading] = useState(false)
  // Honeypot — bots fill hidden fields, humans don't
  const [honeypot, setHoneypot] = useState('')

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    if (honeypot) return // silent bot block
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
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

    // Account created and session established — proceed to welcome
    router.push('/onboarding/welcome')
  }

  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <MeridianBeacon size={48} variant="gold" animate={false} />
          <h1 className="text-[28px] font-light text-white mt-4 tracking-tight italic">meridian arc</h1>
          <p className="text-[13px] text-white/40 mt-1">The home screen of your life</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-xl">
          <p className="text-[11px] text-[var(--text3)] uppercase tracking-widest font-semibold mb-1">Step 1 of 5</p>
          <h2 className="text-[18px] font-medium text-[var(--text)] mb-5">Create your account</h2>

          {accountExists && (
            <div className="mb-4 p-3 rounded-lg bg-[var(--red-lt)] text-[var(--red)] text-[13px]">
              Account exists —{' '}
              <Link href="/login" className="underline font-medium">
                sign in instead
              </Link>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-[var(--red-lt)] text-[var(--red)] text-[13px]">
              {error}
            </div>
          )}

          {/* Honeypot */}
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
              {loading ? 'Creating account...' : 'Create account →'}
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
