'use client'

import { useState } from 'react'
import MeridianBeacon from '@/components/brand/MeridianBeacon'

interface SweepButtonProps {
  lastSweepAt?: string | null
  nextSweepAt?: string | null
  onSweepComplete?: (result: unknown) => void
}

export default function SweepButton({ lastSweepAt, nextSweepAt: nextSweepAtProp, onSweepComplete }: SweepButtonProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nextSweepAt, setNextSweepAt] = useState<string | null>(nextSweepAtProp ?? null)

  const isRateLimited = nextSweepAt !== null && new Date(nextSweepAt) > new Date()

  async function handleSweep() {
    if (isRateLimited) return
    setIsRunning(true)
    setError(null)

    try {
      const res = await fetch('/api/sweep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const data = await res.json() as { error?: string; next_sweep_at?: string; [key: string]: unknown }

      if (!res.ok) {
        if (res.status === 429 && data.next_sweep_at) {
          setNextSweepAt(data.next_sweep_at)
        } else {
          setError(data.error ?? 'Sweep failed')
        }
        return
      }

      onSweepComplete?.(data)
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sweep failed')
    } finally {
      setIsRunning(false)
    }
  }

  function formatLastSweep(dateStr: string) {
    const diffHours = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60))
    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours}h ago`
    return `${Math.floor(diffHours / 24)}d ago`
  }

  function formatNextSweep(dateStr: string) {
    const diffMs = new Date(dateStr).getTime() - Date.now()
    if (diffMs <= 0) return 'now'
    const mins = Math.ceil(diffMs / (1000 * 60))
    if (mins < 60) return `in ${mins}m`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`
  }

  const disabled = isRunning || isRateLimited

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleSweep}
        disabled={disabled}
        className={`flex items-center gap-2.5 px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
          disabled
            ? 'bg-navy/40 text-white/50 cursor-not-allowed'
            : 'bg-navy text-white hover:bg-[var(--night)]'
        }`}
      >
        <MeridianBeacon
          size={16}
          variant="gold"
          animate={isRunning}
          arrowTip={true}
        />
        {isRunning ? 'Sweeping...' : 'Run Sweep'}
      </button>

      {isRateLimited && nextSweepAt ? (
        <span className="text-[10px] text-[var(--text3)]">
          Next sweep available {formatNextSweep(nextSweepAt)}
        </span>
      ) : lastSweepAt && !isRunning ? (
        <span className="text-[10px] text-[var(--text3)]">
          Last sweep: {formatLastSweep(lastSweepAt)}
        </span>
      ) : null}

      {error && (
        <span className="text-[10px] text-[var(--red)]">{error}</span>
      )}
    </div>
  )
}
