'use client'

import { useRouter } from 'next/navigation'
import MeridianBeacon from '@/components/brand/MeridianBeacon'
import Link from 'next/link'

export default function OnboardingWelcomePage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center px-4 text-center">
      <div className="mb-8">
        <MeridianBeacon size={80} variant="gold" animate={true} launchSequence={true} />
      </div>
      <h1 className="text-[36px] font-light text-white mb-3 tracking-tight">
        The home screen of your life.
      </h1>
      <p className="text-[16px] text-white/50 max-w-md mb-10 leading-relaxed">
        Meridian monitors your most important objectives — tracking signals, synthesizing intelligence, and surfacing what matters most today.
      </p>
      <button
        onClick={() => router.push('/onboarding/profile')}
        className="px-8 py-3.5 rounded-xl bg-gold text-navy text-[15px] font-semibold hover:bg-gold/90 transition-colors"
      >
        Get started
      </button>
      <Link href="/login" className="mt-4 text-[13px] text-white/30 hover:text-white/60 transition-colors">
        I already have an account
      </Link>
    </div>
  )
}
