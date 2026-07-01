'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import MeridianBeacon from '@/components/brand/MeridianBeacon'
import { timeAgo } from '@/lib/utils/timeAgo'

interface SweepStatusStripProps {
  lastSweepAt: string | null
}

const SCANNING_MESSAGES = ['Finding signals…', 'Synthesizing…', 'Calculating scores…']

export default function SweepStatusStrip({ lastSweepAt }: SweepStatusStripProps) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [msgIdx, setMsgIdx] = useState(0)

  async function handleGetUpdate() {
    setRunning(true)
    setMsgIdx(0)
    const interval = setInterval(() => {
      setMsgIdx(prev => Math.min(prev + 1, SCANNING_MESSAGES.length - 1))
    }, 1800)

    try {
      const res = await fetch('/api/sweep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json() as { sweep_id?: string }
      clearInterval(interval)
      if (data.sweep_id) {
        router.push(`/sweep/${data.sweep_id}`)
        return
      }
    } catch {
      clearInterval(interval)
    }
    setRunning(false)
  }

  return (
    <div
      className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
      style={{ backgroundColor: 'rgba(46,124,184,0.08)', border: '1px solid rgba(46,124,184,0.18)' }}
    >
      <span className="text-[12px] flex items-center gap-2" style={{ color: 'var(--ov-text-mid)' }}>
        {running && <MeridianBeacon size={16} variant="gold" animate={true} />}
        {running ? SCANNING_MESSAGES[msgIdx] : lastSweepAt ? `Last update ${timeAgo(lastSweepAt)}` : 'No scan yet'}
      </span>
      <button
        onClick={handleGetUpdate}
        disabled={running}
        className="text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
        style={{ backgroundColor: 'var(--blue)', color: '#fff' }}
      >
        {running ? 'Scanning…' : 'Get my update'}
      </button>
    </div>
  )
}
