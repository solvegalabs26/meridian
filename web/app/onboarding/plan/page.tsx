'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { TIERS, SWEEP_CREDIT_BUNDLES, type TierKey } from '@/lib/subscription/tiers'
import MeridianArcWordmark from '@/components/brand/MeridianArcWordmark'

const TIER_ORDER: TierKey[] = ['trial', 'explorer', 'accelerator', 'command']

function PlanPageInner() {
  const router = useRouter()
  const params = useSearchParams()
  const upgrade = params.get('upgrade') === 'true'
  const expired = params.get('expired') === 'true'

  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const [selected, setSelected] = useState<TierKey>('accelerator')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Redirect authenticated users who already have a tier set (unless upgrade/expired)
  useEffect(() => {
    if (!upgrade && !expired) {
      // Allow plan selection from onboarding flow even if tier already set
    }
  }, [upgrade, expired])

  async function handleSelect() {
    setSaving(true)
    setError(null)
    const res = await fetch('/api/plan/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: selected }),
    })
    if (!res.ok) {
      const d = await res.json() as { error?: string }
      setError(d.error ?? 'Something went wrong')
      setSaving(false)
      return
    }
    router.push('/dashboard')
  }

  async function handleTrialContinue() {
    setSaving(true)
    setError(null)
    const res = await fetch('/api/plan/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'trial' }),
    })
    if (!res.ok) {
      const d = await res.json() as { error?: string }
      setError(d.error ?? 'Something went wrong')
      setSaving(false)
      return
    }
    router.push('/dashboard')
  }

  const annualSavingsPct = Math.round((1 - 190 / (19 * 12)) * 100)

  return (
    <div className="min-h-screen bg-navy py-12 px-4">
      <div className="max-w-5xl mx-auto">

        {/* Wordmark */}
        <div className="flex justify-center mb-10">
          <MeridianArcWordmark size="md" animate={false} />
        </div>

        {/* Banner */}
        {(upgrade || expired) && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-[13px] text-center">
            {expired
              ? 'Your 7-day trial has ended. Choose a plan to continue using Meridian.'
              : 'Upgrade your plan to access this feature.'}
          </div>
        )}

        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className="text-[30px] font-medium text-white mb-2">Choose your plan</h1>
          <p className="text-[15px] text-white/55">Start free. Upgrade when Meridian proves its value.</p>
        </div>

        {/* Billing toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-white/8 rounded-xl p-1 gap-1">
            {(['monthly', 'annual'] as const).map(b => (
              <button
                key={b}
                onClick={() => setBilling(b)}
                className={`px-5 py-2 rounded-lg text-[13px] font-medium transition-all ${
                  billing === b
                    ? 'bg-white text-navy'
                    : 'text-white/55 hover:text-white'
                }`}
              >
                {b === 'monthly' ? 'Monthly' : `Annual — save ${annualSavingsPct}%`}
              </button>
            ))}
          </div>
        </div>

        {/* Tier cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {TIER_ORDER.map(key => {
            const tier = TIERS[key]
            const isSelected = selected === key
            const isRecommended = key === 'accelerator'
            const isTrial = key === 'trial'
            const price = billing === 'annual' && !isTrial
              ? tier.price_annual
              : tier.price_monthly

            return (
              <button
                key={key}
                onClick={() => setSelected(key)}
                className={`relative text-left rounded-2xl p-5 border-2 transition-all ${
                  isSelected
                    ? isRecommended
                      ? 'border-[#C9A84C] bg-[#C9A84C]/8 shadow-lg'
                      : 'border-white bg-white/8 shadow-lg'
                    : isTrial
                      ? 'border-white/20 bg-white/4 hover:border-white/35'
                      : 'border-white/30 bg-white/6 hover:border-white/50'
                }`}
              >
                {isRecommended && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#C9A84C] text-[10px] font-bold tracking-widest uppercase text-navy px-3 py-1 rounded-full">
                    Recommended
                  </span>
                )}

                <p className="text-[12px] font-semibold tracking-widest uppercase text-white/50 mb-1">{tier.label}</p>

                <div className="mb-4">
                  {isTrial ? (
                    <>
                      <span className="text-[28px] font-medium text-white">Free</span>
                      <p className="text-[11px] text-white/45 mt-0.5">7 days · No credit card required</p>
                    </>
                  ) : (
                    <>
                      <span className="text-[28px] font-medium text-white">
                        ${billing === 'annual' ? Math.round(price / 12) : price}
                      </span>
                      <span className="text-[13px] text-white/45">/mo</span>
                      {billing === 'annual' && (
                        <p className="text-[11px] text-white/45 mt-0.5">${price}/yr billed annually</p>
                      )}
                    </>
                  )}
                </div>

                <ul className="space-y-1.5">
                  {tier.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-[12px] text-white/70">
                      <Check size={12} className="mt-0.5 shrink-0 text-white/40" />
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>

        {/* Sweep credits */}
        <div className="bg-white/6 border border-white/15 rounded-2xl p-5 mb-6">
          <p className="text-[12px] font-semibold uppercase tracking-widest text-white/50 mb-1">Sweep credits — add-on</p>
          <p className="text-[13px] text-white/60 mb-4">Never-expiring extra sweeps available on any plan.</p>
          <div className="grid grid-cols-3 gap-3">
            {SWEEP_CREDIT_BUNDLES.map(b => (
              <div
                key={b.credits}
                className={`relative rounded-xl border p-4 text-center ${
                  b.best_value
                    ? 'border-[#C9A84C]/60 bg-[#C9A84C]/8'
                    : 'border-white/20 bg-white/4'
                }`}
              >
                {b.best_value && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#C9A84C] text-[9px] font-bold tracking-widest uppercase text-navy px-2 py-0.5 rounded-full">
                    Best value
                  </span>
                )}
                <p className="text-[20px] font-medium text-white">{b.credits}</p>
                <p className="text-[11px] text-white/45 mb-1">sweeps</p>
                <p className="text-[16px] font-medium text-white">${b.price}</p>
                <p className="text-[10px] text-white/35">${b.per_credit.toFixed(2)} each</p>
                <button
                  disabled
                  className="mt-3 w-full py-1.5 rounded-lg border border-white/20 text-[11px] text-white/40 cursor-not-allowed"
                >
                  {/* TODO: wire to Stripe when billing is built */}
                  Coming soon
                </button>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-[13px] text-center">
            {error}
          </div>
        )}

        {/* CTA */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={handleSelect}
            disabled={saving}
            className="w-full max-w-sm py-3 rounded-xl bg-white text-navy text-[15px] font-semibold hover:bg-white/90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : `Start with ${TIERS[selected].label} →`}
          </button>

          {selected !== 'trial' && (
            <button
              onClick={handleTrialContinue}
              disabled={saving}
              className="text-[13px] text-white/40 hover:text-white/60 transition-colors disabled:opacity-50"
            >
              Continue with Trial instead
            </button>
          )}
        </div>

        {/* Enterprise */}
        <p className="text-center text-[12px] text-white/35 mt-6">
          For teams —{' '}
          <a href="mailto:connect@solvega.ai" className="text-white/55 hover:text-white underline transition-colors">
            contact us at connect@solvega.ai
          </a>
        </p>

        {/* Disclaimer */}
        <div className="mt-8 p-5 rounded-xl border border-white/10 bg-white/4">
          <p className="text-[10px] font-bold tracking-widest uppercase text-white/40 mb-2">Important Notice</p>
          <p className="text-[11px] text-white/40 leading-relaxed">
            Meridian Arc provides AI-generated signal analysis and confidence scoring for informational
            purposes only. It is not financial, legal, career, or investment advice. Confidence scores
            are probabilistic estimates, not guarantees of outcomes. Always verify signals independently
            before making decisions. By selecting a plan, you agree to our{' '}
            <Link href="/legal/terms" className="underline hover:text-white/60 transition-colors">
              Terms of Service
            </Link>
            {' '}and{' '}
            <Link href="/legal/privacy" className="underline hover:text-white/60 transition-colors">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}

export default function PlanPage() {
  return (
    <Suspense>
      <PlanPageInner />
    </Suspense>
  )
}
