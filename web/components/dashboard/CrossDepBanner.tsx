'use client'

import { useEffect, useState } from 'react'

export interface CrossDep {
  id: string
  fromObjective: string
  toObjective: string
  description: string
}

interface CrossDepBannerProps {
  crossDeps: CrossDep[]
}

const DISMISSED_KEY = 'meridian_dismissed_cross_deps'

function loadDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]')
  } catch {
    return []
  }
}

export default function CrossDepBanner({ crossDeps }: CrossDepBannerProps) {
  const [dismissed, setDismissed] = useState<string[]>([])

  useEffect(() => {
    setDismissed(loadDismissed())
  }, [])

  function dismiss(id: string) {
    const next = [...dismissed, id]
    setDismissed(next)
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(next))
  }

  const visible = crossDeps.filter(dep => !dismissed.includes(dep.id))
  if (visible.length === 0) return null

  return (
    <div className="space-y-2">
      {visible.map(dep => (
        <div
          key={dep.id}
          className="rounded-xl p-3.5 flex items-start gap-2.5 relative"
          style={{
            backgroundColor: 'rgba(184,122,21,0.08)',
            border: '1px solid rgba(184,122,21,0.22)',
            borderLeft: '3px solid var(--ov-amber)',
          }}
        >
          <span className="text-[14px] flex-shrink-0 leading-none mt-0.5">🔗</span>
          <p className="text-[13px] leading-relaxed pr-5" style={{ color: 'var(--ov-text-mid)' }}>
            Your <strong style={{ color: 'var(--ov-text-hi)' }}>{dep.fromObjective}</strong> is affecting{' '}
            <strong style={{ color: 'var(--ov-text-hi)' }}>{dep.toObjective}</strong>. {dep.description}
          </p>
          <button
            onClick={() => dismiss(dep.id)}
            aria-label="Dismiss"
            className="absolute top-3 right-3 text-[12px]"
            style={{ color: 'var(--ov-text-dim)' }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
