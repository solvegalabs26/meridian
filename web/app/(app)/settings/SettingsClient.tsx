'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SWEEP_CREDIT_BUNDLES } from '@/lib/subscription/tiers'

interface Profile {
  full_name: string | null
  tone_pref: string | null
  depth_pref: string | null
  tier: string | null
  sweep_count: number | null
  sweep_credits: number | null
  trial_ends_at: string | null
  account_type: string | null
  onboarded_at: string | null
  created_at: string | null
}

interface Props {
  email: string
  profile: Profile | null
}

const TIER_LABELS: Record<string, string> = {
  trial: 'Trial',
  explorer: 'Explorer',
  accelerator: 'Accelerator',
  command: 'Command',
}

const TIER_BADGE: Record<string, string> = {
  trial:       'bg-gray-100 text-gray-600',
  explorer:    'bg-blue-100 text-blue-700',
  accelerator: 'bg-amber-100 text-amber-700',
  command:     'bg-purple-100 text-purple-700',
}

const ALPHA_BETA_TYPES = ['alpha_personal', 'alpha_business', 'beta']

export default function SettingsClient({ email, profile }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [tone, setTone] = useState(profile?.tone_pref ?? 'balanced')
  const [depth, setDepth] = useState(profile?.depth_pref ?? 'standard')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName, tone_pref: tone, depth_pref: depth }),
    })
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      router.refresh()
    } else {
      const d = await res.json() as { error?: string }
      setError(d.error ?? 'Save failed')
    }
    setSaving(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-medium text-[var(--text)]">Settings</h1>
        <p className="text-[13px] text-[var(--text3)] mt-0.5">Profile and intelligence preferences</p>
      </div>

      <div className="space-y-4">
        {/* Account */}
        <div className="bg-white rounded-2xl border border-[var(--border)] p-6">
          <h2 className="text-[13px] font-semibold text-[var(--text)] uppercase tracking-wider mb-4">Account</h2>
          <div className="space-y-3 text-[13px]">
            <div className="flex justify-between py-2 border-b border-[var(--border)]">
              <span className="text-[var(--text3)]">Email</span>
              <span className="text-[var(--text2)]">{email}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[var(--text3)]">Member since</span>
              <span className="text-[var(--text2)]">
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                  : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Profile */}
        <div className="bg-white rounded-2xl border border-[var(--border)] p-6">
          <h2 className="text-[13px] font-semibold text-[var(--text)] uppercase tracking-wider mb-4">Profile</h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-[var(--red-lt)] text-[var(--red)] text-[13px]">{error}</div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1.5">Full name</label>
              <input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-[14px] text-[var(--text)] focus:outline-none focus:border-[var(--blue)] transition-colors"
                placeholder="Your name"
              />
            </div>

            {/* Tone preference */}
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-2">
                Tone preference — how Meridian Arc speaks to you
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { value: 'direct', label: 'Direct', desc: 'Blunt, no sugar-coating' },
                  { value: 'balanced', label: 'Balanced', desc: 'Clear and professional' },
                  { value: 'encouraging', label: 'Encouraging', desc: 'Supportive and motivating' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setTone(opt.value)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      tone === opt.value
                        ? 'border-[var(--blue)] bg-[#E6F1FB]'
                        : 'border-[var(--border)] hover:border-[var(--blue-mid)]'
                    }`}
                  >
                    <p className={`text-[13px] font-medium ${tone === opt.value ? 'text-[var(--blue)]' : 'text-[var(--text)]'}`}>
                      {opt.label}
                    </p>
                    <p className="text-[11px] text-[var(--text3)] mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Depth preference */}
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-2">
                Depth preference — how detailed Meridian Arc&apos;s analysis is
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { value: 'brief', label: 'Brief', desc: 'Key points only' },
                  { value: 'standard', label: 'Standard', desc: 'Balanced detail' },
                  { value: 'detailed', label: 'Detailed', desc: 'Full analysis' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setDepth(opt.value)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      depth === opt.value
                        ? 'border-[var(--blue)] bg-[#E6F1FB]'
                        : 'border-[var(--border)] hover:border-[var(--blue-mid)]'
                    }`}
                  >
                    <p className={`text-[13px] font-medium ${depth === opt.value ? 'text-[var(--blue)]' : 'text-[var(--text)]'}`}>
                      {opt.label}
                    </p>
                    <p className="text-[11px] text-[var(--text3)] mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2.5 rounded-lg bg-navy text-white text-[14px] font-medium hover:bg-[var(--night)] transition-colors disabled:opacity-50"
            >
              {saved ? '✓ Saved' : saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>

        {/* Plan & Billing */}
        {(() => {
          const tier = profile?.tier ?? 'trial'
          const tierLabel = TIER_LABELS[tier] ?? tier
          const badgeClass = TIER_BADGE[tier] ?? TIER_BADGE.trial
          const isAlphaBeta = ALPHA_BETA_TYPES.includes(profile?.account_type ?? '')
          const sweepCredits = profile?.sweep_credits ?? 0
          const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null
          const trialExpired = tier === 'trial' && trialEndsAt && trialEndsAt < new Date()
          const trialActive  = tier === 'trial' && trialEndsAt && trialEndsAt >= new Date()

          return (
            <div className="bg-white rounded-2xl border border-[var(--border)] p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[13px] font-semibold text-[var(--text)] uppercase tracking-wider">Plan &amp; Billing</h2>
                {!isAlphaBeta && (
                  <Link
                    href="/onboarding/plan"
                    className="text-[12px] text-[var(--blue)] hover:underline"
                  >
                    Change plan
                  </Link>
                )}
              </div>

              <div className="space-y-3 text-[13px]">
                {/* Tier badge */}
                <div className="flex items-center justify-between py-2 border-b border-[var(--border)]">
                  <span className="text-[var(--text3)]">Current plan</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${badgeClass}`}>
                    {tierLabel}{isAlphaBeta ? ' · Alpha/Beta' : ''}
                  </span>
                </div>

                {/* Trial end date */}
                {(trialActive || trialExpired) && (
                  <div className="flex items-center justify-between py-2 border-b border-[var(--border)]">
                    <span className="text-[var(--text3)]">Trial {trialExpired ? 'ended' : 'ends'}</span>
                    <span className={`text-[var(--text2)] ${trialExpired ? 'text-red-500' : ''}`}>
                      {trialEndsAt!.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {trialExpired && ' — expired'}
                    </span>
                  </div>
                )}

                {/* Sweep credits */}
                <div className="flex items-center justify-between py-2 border-b border-[var(--border)]">
                  <span className="text-[var(--text3)]">Sweep credits</span>
                  <span className="text-[var(--text2)] font-medium">{sweepCredits}</span>
                </div>

                {/* Sweeps run */}
                <div className="flex items-center justify-between py-2">
                  <span className="text-[var(--text3)]">Sweeps run</span>
                  <span className="text-[var(--text2)]">{profile?.sweep_count ?? 0}</span>
                </div>
              </div>

              {/* Credit bundles */}
              <div className="mt-5 pt-4 border-t border-[var(--border)]">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text3)] mb-3">Add sweep credits</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {SWEEP_CREDIT_BUNDLES.map(b => (
                    <div
                      key={b.credits}
                      className={`relative rounded-xl border p-3 text-center ${
                        b.best_value ? 'border-amber-300 bg-amber-50' : 'border-[var(--border)] bg-[var(--gray-lt)]'
                      }`}
                    >
                      {b.best_value && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-amber-500 text-[8px] font-bold tracking-widest uppercase text-white px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          Best value
                        </span>
                      )}
                      <p className="text-[16px] font-medium text-[var(--text)]">{b.credits}</p>
                      <p className="text-[10px] text-[var(--text3)] mb-1">sweeps</p>
                      <p className="text-[13px] font-medium text-[var(--text)]">${b.price}</p>
                      <button
                        disabled
                        className="mt-2 w-full py-1 rounded-lg border border-[var(--border)] text-[10px] text-[var(--text3)] cursor-not-allowed opacity-50"
                      >
                        Coming soon
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })()}

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="w-full py-2.5 rounded-lg border border-[var(--red)]/30 text-[var(--red)] text-[13px] hover:bg-[var(--red-lt)] transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
