'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import MeridianBeacon from '@/components/brand/MeridianBeacon'

const MESSAGES = [
  'Scanning signals...',
  'Synthesizing...',
  'Calculating confidence...',
  'Compiling confidence score...',
]

export default function OnboardingSweepPage() {
  const router = useRouter()
  const [msgIdx, setMsgIdx] = useState(0)
  const [done, setDone] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    // Cycle messages
    const interval = setInterval(() => {
      setMsgIdx(prev => Math.min(prev + 1, MESSAGES.length - 1))
    }, 1800)

    // Run first sweep
    fetch('/api/sweep', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then(r => r.json())
      .then((data: { objectives?: Array<{ confidence_new: number }> }) => {
        clearInterval(interval)
        setMsgIdx(3) // "Compiling confidence score..."
        const avgScore = data.objectives
          ? Math.round(data.objectives.reduce((acc, o) => acc + o.confidence_new, 0) / data.objectives.length)
          : 50
        // Brief pause so user sees the "Compiling..." message before score reveal
        setTimeout(() => {
          setScore(avgScore)
          setDone(true)
        }, 1200)
      })
      .catch(() => {
        clearInterval(interval)
        setMsgIdx(3)
        setScore(50)
        setDone(true)
        setError(true)
      })

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center px-4 text-center">
      <div className="mb-8">
        <MeridianBeacon size={80} variant="gold" animate={!done} launchSequence={false} />
      </div>

      {!done ? (
        <>
          <p className="text-[11px] text-white/30 tracking-widest uppercase mb-3">Step 5 of 5</p>
          <h2 className="text-[22px] font-light text-white mb-2">Running your first sweep</h2>
          <p className="text-[15px] text-white/50 transition-all duration-500">{MESSAGES[msgIdx]}</p>
        </>
      ) : (
        <div className="animate-fade-in">
          <p className="text-[11px] text-white/30 tracking-widest uppercase mb-3">First sweep complete</p>
          {score !== null && (
            <div className="mb-4">
              <span className="text-[64px] font-light text-[#C9A227]">{score}</span>
              <span className="text-[28px] text-[#C9A227]">%</span>
              <p className="text-[13px] text-white/40 mt-1">Average confidence across your objectives</p>
            </div>
          )}
          {error && (
            <p className="text-[12px] text-white/30 mb-4">Add more signals to improve accuracy after setup.</p>
          )}
          <button
            onClick={() => router.push('/dashboard')}
            className="px-8 py-3 rounded-xl bg-gold text-navy text-[15px] font-semibold hover:bg-gold/90 transition-colors"
          >
            Go to Mission Control →
          </button>
        </div>
      )}
    </div>
  )
}
