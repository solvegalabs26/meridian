'use client'

import { useState, useEffect } from 'react'
import { markAlertSeen } from '@/lib/watchlist/markAlertSeen'

type CriticalAlert = {
  id: string
  signal_summary: string
  action_text: string
  direct_url: string | null
  objective_title: string
  unseen_count: number
}

export default function WatchAlertBanner() {
  const [alert, setAlert] = useState<CriticalAlert | null | undefined>(undefined)
  const [marking, setMarking] = useState(false)

  useEffect(() => {
    fetch('/api/watch-alerts')
      .then(r => r.ok ? r.json() as Promise<CriticalAlert | null> : null)
      .then(data => setAlert(data))
      .catch(() => setAlert(null))
  }, [])

  // undefined = loading (render nothing); null = no alert (render nothing)
  if (!alert) return null

  async function handleMarkSeen() {
    if (marking || !alert) return
    setMarking(true)
    await markAlertSeen(alert.id)
    setAlert(null)
  }

  return (
    <div
      className="w-full px-4 py-2.5 flex items-start gap-3 flex-wrap"
      style={{ backgroundColor: '#C9A227', color: '#0A1628' }}
    >
      {/* Left: icon + title + body */}
      <div className="flex items-baseline gap-2 flex-1 min-w-0 flex-wrap">
        <span className="text-[13px] font-bold flex-shrink-0">⚠ MERIDIAN ALERT</span>
        {alert.objective_title && (
          <span className="text-[13px] font-semibold flex-shrink-0">— {alert.objective_title}</span>
        )}
        <span className="text-[12px]">{alert.signal_summary}</span>
        <span className="text-[12px] font-medium">ACTION: {alert.action_text}</span>
      </div>

      {/* Right: action buttons */}
      <div className="flex items-center gap-3 flex-shrink-0 self-center">
        {alert.direct_url && (
          <a
            href={alert.direct_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] font-bold underline underline-offset-2 whitespace-nowrap"
            style={{ color: '#0A1628' }}
          >
            View →
          </a>
        )}
        <button
          onClick={handleMarkSeen}
          disabled={marking}
          className="text-[12px] font-medium px-2.5 py-1 rounded-md border whitespace-nowrap transition-colors disabled:opacity-50 hover:bg-black/10"
          style={{ borderColor: 'rgba(10,22,40,0.35)', color: '#0A1628' }}
        >
          {marking ? 'Marking…' : 'Mark as seen'}
        </button>
      </div>
    </div>
  )
}
