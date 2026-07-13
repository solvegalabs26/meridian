'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import MeridianBeacon from '@/components/brand/MeridianBeacon'

const OPTIONS = [
  {
    icon: '🎯',
    label: 'Career transition or job search',
    sublabel: 'Separating from service, changing\n industries, or targeting a new role',
    value: 'career_transition',
  },
  {
    icon: '📈',
    label: 'Growing or running a business',
    sublabel: 'Revenue targets, hiring, market\n expansion, or operational goals',
    value: 'business_owner',
  },
  {
    icon: '🌱',
    label: 'Personal goals',
    sublabel: 'Financial targets, health, family\n milestones, or life planning',
    value: 'personal',
  },
  {
    icon: '⚡',
    label: 'A mix of all of these',
    sublabel: "I'm managing multiple types\n of goals simultaneously",
    value: 'general',
  },
]

export default function OnboardingContextPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function saveAndContinue(context: string) {
    setSaving(true)
    setError(null)

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboarding_context: context }),
    })

    if (!res.ok) {
      setError('Could not save — please try again.')
      setSaving(false)
      return
    }

    router.push('/onboarding/profile')
  }

  async function handleContinue() {
    if (!selected) return
    await saveAndContinue(selected)
  }

  async function handleSkip() {
    await saveAndContinue('general')
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <MeridianBeacon size={40} variant="gold" animate={false} />
          <p className="text-[11px] text-white/30 mt-3 tracking-widest uppercase">Step 2 of 5</p>
          <h1 className="text-[24px] font-light text-white mt-1">What are you working toward?</h1>
          <p className="text-[13px] text-white/40 mt-2 max-w-sm mx-auto leading-relaxed">
            Meridian tailors your first experience based on what matters most to you right now.
            You can track any mix of goals — this just helps us start you in the right place.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSelected(opt.value)}
              className={`w-full text-left rounded-xl border-2 p-4 flex items-start gap-4 transition-all ${
                selected === opt.value
                  ? 'border-[var(--gold)] bg-[#C9A22715]'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              }`}
            >
              <span className="text-[24px] leading-none mt-0.5 flex-shrink-0">{opt.icon}</span>
              <div>
                <p className={`text-[14px] font-medium leading-snug ${selected === opt.value ? 'text-[var(--gold)]' : 'text-white'}`}>
                  {opt.label}
                </p>
                <p className="text-[12px] text-white/40 mt-0.5 whitespace-pre-line">{opt.sublabel}</p>
              </div>
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/30 text-red-300 text-[13px]">{error}</div>
        )}

        <button
          onClick={handleContinue}
          disabled={!selected || saving}
          className="w-full py-3 rounded-xl bg-gold text-navy text-[15px] font-semibold hover:bg-gold/90 disabled:opacity-40 transition-colors"
        >
          {saving ? 'Saving...' : 'Continue →'}
        </button>

        <button
          onClick={handleSkip}
          disabled={saving}
          className="w-full mt-3 py-2 text-[12px] text-white/30 hover:text-white/60 transition-colors"
        >
          Skip this step
        </button>
      </div>
    </div>
  )
}
