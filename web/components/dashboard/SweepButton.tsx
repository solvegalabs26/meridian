'use client'

import { useState } from 'react'
import MeridianBeacon from '@/components/brand/MeridianBeacon'

interface SweepButtonProps {
  lastSweepAt?: string | null
  onSweepComplete?: (result: unknown) => void
}

export default function SweepButton({ lastSweepAt, onSweepComplete }: SweepButtonProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSweep() {
    setIsRunning(true)
    setError(null)

    try {
      const res = await fetch('/api/sweep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Sweep failed')
        return
      }

      onSweepComplete?.(data)
      // Refresh the page to show updated data
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sweep failed')
    } finally {
      setIsRunning(false)
    }
  }

  function formatLastSweep(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleSweep}
        disabled={isRunning}
        className={`flex items-center gap-2.5 px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
          isRunning
            ? 'bg-navy/80 text-white cursor-not-allowed'
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

      {lastSweepAt && !isRunning && (
        <span className="text-[10px] text-[var(--text3)]">
          Last sweep: {formatLastSweep(lastSweepAt)}
        </span>
      )}

      {error && (
        <span className="text-[10px] text-[var(--red)]">{error}</span>
      )}
    </div>
  )
}
