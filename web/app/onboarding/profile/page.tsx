'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import MeridianBeacon from '@/components/brand/MeridianBeacon'

export default function OnboardingProfilePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [tone, setTone] = useState('balanced')
  const [depth, setDepth] = useState('standard')
  const [saving, setSaving] = useState(false)

  async function handleNext() {
    setSaving(true)
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: name, tone_pref: tone, depth_pref: depth }),
    })
    router.push('/onboarding/objective')
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <MeridianBeacon size={40} variant="gold" animate={false} />
          <p className="text-[11px] text-white/30 mt-3 tracking-widest uppercase">Step 2 of 4</p>
          <h1 className="text-[24px] font-light text-white mt-1">Set up your profile</h1>
        </div>

        <div className="bg-white rounded-2xl p-6 space-y-5">
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1.5">Your name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Jason"
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-[14px] focus:outline-none focus:border-[var(--blue)]" />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-2">How should Meridian speak to you?</label>
            <div className="grid grid-cols-3 gap-2">
              {[{v:'direct',l:'Direct'},{v:'balanced',l:'Balanced'},{v:'encouraging',l:'Encouraging'}].map(o => (
                <button key={o.v} onClick={() => setTone(o.v)}
                  className={`py-2 rounded-lg border text-[13px] transition-all ${tone === o.v ? 'border-[var(--blue)] bg-[#E6F1FB] text-[var(--blue)] font-medium' : 'border-[var(--border)] text-[var(--text2)]'}`}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-2">How detailed should analysis be?</label>
            <div className="grid grid-cols-3 gap-2">
              {[{v:'brief',l:'Brief'},{v:'standard',l:'Standard'},{v:'detailed',l:'Detailed'}].map(o => (
                <button key={o.v} onClick={() => setDepth(o.v)}
                  className={`py-2 rounded-lg border text-[13px] transition-all ${depth === o.v ? 'border-[var(--blue)] bg-[#E6F1FB] text-[var(--blue)] font-medium' : 'border-[var(--border)] text-[var(--text2)]'}`}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleNext} disabled={saving || !name.trim()}
            className="w-full py-2.5 rounded-lg bg-navy text-white text-[14px] font-medium hover:bg-[var(--night)] disabled:opacity-50 transition-colors">
            {saving ? 'Saving...' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}
