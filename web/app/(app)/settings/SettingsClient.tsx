'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Profile {
  full_name: string | null
  tone_pref: string | null
  depth_pref: string | null
  tier: string | null
  sweep_count: number | null
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
            <div className="flex justify-between py-2 border-b border-[var(--border)]">
              <span className="text-[var(--text3)]">Tier</span>
              <span className="capitalize font-medium text-[var(--text)]">
                {TIER_LABELS[profile?.tier ?? 'trial'] ?? profile?.tier ?? 'Trial'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-[var(--border)]">
              <span className="text-[var(--text3)]">Sweeps run</span>
              <span className="text-[var(--text2)]">{profile?.sweep_count ?? 0}</span>
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
              <div className="grid grid-cols-3 gap-2">
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
              <div className="grid grid-cols-3 gap-2">
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

        {/* Coming soon */}
        <div className="bg-white rounded-2xl border border-[var(--border)] p-6">
          <h2 className="text-[13px] font-semibold text-[var(--text)] uppercase tracking-wider mb-4">Billing</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] text-[var(--text2)]">Current plan: <strong>{TIER_LABELS[profile?.tier ?? 'trial']}</strong></p>
              <p className="text-[11px] text-[var(--text3)] mt-0.5">Stripe billing — coming in v1.1</p>
            </div>
            <button disabled className="px-4 py-2 rounded-lg border border-[var(--border)] text-[12px] text-[var(--text3)] cursor-not-allowed opacity-50">
              Upgrade — Coming soon
            </button>
          </div>
        </div>

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
