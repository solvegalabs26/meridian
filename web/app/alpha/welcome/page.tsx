'use client'

import { useRouter } from 'next/navigation'
import MeridianBeacon from '@/components/brand/MeridianBeacon'

export default function AlphaWelcomePage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center px-4 text-center">
      <div className="mb-8">
        <MeridianBeacon size={80} variant="gold" animate={true} launchSequence={true} />
      </div>
      <p className="text-[11px] text-white/30 mb-4 tracking-widest uppercase">Step 3 of 6</p>
      <h1 className="text-[36px] font-light text-white mb-3 tracking-tight">
        The home screen of your life.
      </h1>
      <p className="text-[16px] text-white/50 max-w-md mb-10 leading-relaxed">
        Meridian Arc monitors your most important objectives — tracking signals, synthesizing intelligence, and surfacing what matters most today.
      </p>
      <button
        onClick={() => router.push('/alpha/profile')}
        className="px-8 py-3.5 rounded-xl bg-gold text-navy text-[15px] font-semibold hover:bg-gold/90 transition-colors"
      >
        Set up your profile →
      </button>
    </div>
  )
}
