'use client'

import { useState } from 'react'
import ActionsList from './ActionsList'
import type { Factor } from './page'

interface TabSignal {
  id: string
  title: string
  body: string | null
  source: string | null
  source_type: string | null
  signal_class: string | null
  created_at: string
}

interface ObjectiveTabsProps {
  factors: Factor[]
  actions: string[]
  objId: string
  signals: TabSignal[]
  goalDescription: string | null
  goalContext: string | null
  tier: string
  hasCalendar: boolean
}

const DOT_COLORS: Record<Factor['color'], string> = {
  red: 'var(--ov-red)',
  amber: 'var(--ov-amber)',
  green: 'var(--ov-green)',
  blue: 'var(--blue-mid)',
}

const SOURCE_BADGES: Record<string, { label: string; color: string }> = {
  news: { label: 'News', color: 'var(--blue-mid)' },
  calendar: { label: 'Calendar', color: '#2EA88C' },
  inbox: { label: 'Inbox', color: 'var(--gold)' },
  manual: { label: 'Manual', color: 'var(--ov-text-dim)' },
}

const TABS = ["What's affecting it", 'What to do', 'Signals', 'Goal'] as const

export default function ObjectiveTabs({ factors, actions, objId, signals, goalDescription, goalContext, tier, hasCalendar }: ObjectiveTabsProps) {
  const [active, setActive] = useState<typeof TABS[number]>(TABS[0])

  return (
    <div>
      <div className="flex gap-1 mb-4 overflow-x-auto" style={{ borderBottom: '1px solid var(--ov-border)' }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className="text-[12px] font-medium px-3 py-2.5 -mb-px whitespace-nowrap flex-shrink-0"
            style={{
              color: active === tab ? 'var(--gold)' : 'var(--ov-text-dim)',
              borderBottom: active === tab ? '2px solid var(--gold)' : '2px solid transparent',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--ov-navy-card)', border: '1px solid var(--ov-border-md)' }}>
        {active === "What's affecting it" && (() => {
          const depSignals = signals.filter(s => s.signal_class === 'dependency')
          const hasContent = factors.length > 0 || depSignals.length > 0
          if (!hasContent) {
            return <p className="text-[13px]" style={{ color: 'var(--ov-text-dim)' }}>Run a scan to see what&apos;s affecting this goal.</p>
          }
          return (
            <div className="space-y-4">
              {factors.length > 0 && (
                <ul className="space-y-3">
                  {factors.map((f, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: DOT_COLORS[f.color] }} />
                      <div>
                        <p className="text-[13px] font-medium" style={{ color: 'var(--ov-text-hi)' }}>{f.title}</p>
                        <p className="text-[12px] leading-relaxed mt-0.5" style={{ color: 'var(--ov-text-mid)' }}>{f.description}</p>
                        <p className="text-[10px] uppercase tracking-wide mt-1" style={{ color: 'var(--ov-text-dim)' }}>{f.impact}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {depSignals.length > 0 && (
                <div>
                  {factors.length > 0 && <div className="mb-3" style={{ borderTop: '1px solid var(--ov-border)' }} />}
                  <p className="text-[10px] uppercase tracking-wide mb-2.5" style={{ color: 'var(--ov-text-dim)' }}>Cross-goal dependencies</p>
                  <ul className="space-y-3">
                    {depSignals.map(sig => (
                      <li key={sig.id} className="flex gap-3">
                        <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: 'var(--blue-mid)' }} />
                        <div>
                          <p className="text-[13px] font-medium" style={{ color: 'var(--ov-text-hi)' }}>{sig.title}</p>
                          {sig.body && (
                            <p className="text-[12px] leading-relaxed mt-0.5" style={{ color: 'var(--ov-text-mid)' }}>{sig.body}</p>
                          )}
                          <p className="text-[10px] mt-1" style={{ color: 'var(--ov-text-dim)' }}>
                            {new Date(sig.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })()}

        {active === 'What to do' && (
          actions.length === 0 ? (
            <p className="text-[13px]" style={{ color: 'var(--ov-text-dim)' }}>Run a scan to get action items for this goal.</p>
          ) : (
            <ActionsList actions={actions} objId={objId} tier={tier} hasCalendar={hasCalendar} />
          )
        )}

        {active === 'Signals' && (() => {
          // Dependency signals belong in "What's affecting it", never here.
          const feedSignals = signals.filter(s => s.signal_class !== 'dependency')
          return feedSignals.length === 0 ? (
            <p className="text-[13px]" style={{ color: 'var(--ov-text-dim)' }}>No signals yet for this goal.</p>
          ) : (
            <ul className="space-y-2.5">
              {feedSignals.map(sig => {
                const badge = SOURCE_BADGES[sig.source_type ?? ''] ?? { label: sig.source_type ?? 'Signal', color: 'var(--ov-text-dim)' }
                return (
                  <li key={sig.id} className="flex items-start gap-2.5">
                    <span
                      className="text-[9px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 whitespace-nowrap"
                      style={{ backgroundColor: `${badge.color}22`, color: badge.color }}
                    >
                      {badge.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px]" style={{ color: 'var(--ov-text-hi)' }}>{sig.title}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--ov-text-dim)' }}>
                        {new Date(sig.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )
        })()}

        {active === 'Goal' && (
          goalDescription ? (
            <div className="space-y-4">
              <p className="text-[12px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--ov-text-hi)' }}>
                {goalDescription}
              </p>
              {goalContext && (
                <div className="pt-3" style={{ borderTop: '1px solid var(--ov-border)' }}>
                  <p className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--ov-text-dim)' }}>
                    Additional context
                  </p>
                  <p className="text-[12px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--ov-text-mid)' }}>
                    {goalContext}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[13px]" style={{ color: 'var(--ov-text-dim)' }}>
              No original description saved for this goal — it was likely created before this feature existed.
            </p>
          )
        )}
      </div>
    </div>
  )
}
