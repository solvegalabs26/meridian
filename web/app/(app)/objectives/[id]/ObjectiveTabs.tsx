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
  objectiveId: string
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
  user_action: { label: 'You', color: 'var(--gold)' },
}

const ACTION_CLASSES = [
  { value: '', label: 'Select type (optional)' },
  { value: 'listed', label: 'Listed / posted' },
  { value: 'price_change', label: 'Price change' },
  { value: 'inquiry', label: 'Inquiry' },
  { value: 'offer', label: 'Offer' },
  { value: 'showing', label: 'Showing' },
  { value: 'other', label: 'Other' },
]

const TABS = ["What's affecting it", 'What to do', 'Signals', 'Goal'] as const

export default function ObjectiveTabs({ factors, actions, objId, objectiveId, signals, goalDescription, goalContext, tier, hasCalendar }: ObjectiveTabsProps) {
  const [active, setActive] = useState<typeof TABS[number]>(TABS[0])

  // "I did this" form state
  const [logOpen, setLogOpen] = useState(false)
  const [logDesc, setLogDesc] = useState('')
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0])
  const [logClass, setLogClass] = useState('')
  const [logSaving, setLogSaving] = useState(false)
  const [logError, setLogError] = useState<string | null>(null)
  const [logResult, setLogResult] = useState<{ newConfidence: number; reasoning: string } | null>(null)

  async function handleLogAction() {
    if (!logDesc.trim()) return
    setLogSaving(true)
    setLogError(null)
    setLogResult(null)
    try {
      const res = await fetch(`/api/objectives/${objectiveId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: logDesc.trim(),
          action_date: logDate,
          action_class: logClass || null,
          source: 'user_logged',
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Could not save — please try again.')
      }
      const data = await res.json() as { new_confidence?: number; confidence_reasoning?: string }
      setLogResult({
        newConfidence: data.new_confidence ?? 0,
        reasoning: data.confidence_reasoning ?? '',
      })
      setLogDesc('')
      setLogClass('')
      setLogDate(new Date().toISOString().split('T')[0])
    } catch (err) {
      setLogError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLogSaving(false)
    }
  }

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
          const userActionSignals = signals.filter(s => s.signal_class === 'user_action')
          const hasContent = factors.length > 0 || depSignals.length > 0 || userActionSignals.length > 0
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
              {userActionSignals.length > 0 && (
                <div>
                  {(factors.length > 0 || depSignals.length > 0) && <div className="mb-3" style={{ borderTop: '1px solid var(--ov-border)' }} />}
                  <p className="text-[10px] uppercase tracking-wide mb-2.5" style={{ color: 'var(--ov-text-dim)' }}>What you&apos;ve done</p>
                  <ul className="space-y-3">
                    {userActionSignals.map(sig => (
                      <li key={sig.id} className="flex gap-3">
                        <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: 'var(--gold)' }} />
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
          <div className="space-y-4">
            {actions.length === 0 ? (
              <p className="text-[13px]" style={{ color: 'var(--ov-text-dim)' }}>Run a scan to get action items for this goal.</p>
            ) : (
              <ActionsList
                actions={actions}
                objId={objId}
                objectiveId={objectiveId}
                tier={tier}
                hasCalendar={hasCalendar}
              />
            )}

            {/* "I did this" free-form action log */}
            <div style={{ borderTop: '1px solid var(--ov-border)', paddingTop: 16 }}>
              {!logOpen && !logResult && (
                <button
                  onClick={() => setLogOpen(true)}
                  className="text-[12px] font-medium"
                  style={{ color: 'var(--gold)' }}
                >
                  + I did something — log it
                </button>
              )}

              {logResult && (
                <div
                  className="rounded-xl p-3 mb-3"
                  style={{ backgroundColor: 'rgba(201,162,39,0.1)', border: '1px solid rgba(201,162,39,0.25)' }}
                >
                  <p className="text-[12px] font-semibold mb-0.5" style={{ color: 'var(--gold)' }}>
                    Confidence updated to {logResult.newConfidence}%
                  </p>
                  {logResult.reasoning && (
                    <p className="text-[11px] leading-relaxed" style={{ color: 'var(--ov-text-mid)' }}>{logResult.reasoning}</p>
                  )}
                  <button
                    onClick={() => { setLogResult(null); setLogOpen(true) }}
                    className="mt-2 text-[11px]"
                    style={{ color: 'var(--ov-text-dim)' }}
                  >
                    Log another
                  </button>
                </div>
              )}

              {logOpen && (
                <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(201,162,39,0.06)', border: '1px solid rgba(201,162,39,0.2)' }}>
                  <p className="text-[12px] font-semibold mb-3" style={{ color: 'var(--gold)' }}>What did you do?</p>

                  {logError && (
                    <div className="mb-3 px-3 py-2 rounded-lg text-[11px]" style={{ backgroundColor: 'rgba(192,64,42,0.14)', color: 'var(--ov-red)' }}>
                      {logError}
                    </div>
                  )}

                  <div className="mb-2.5">
                    <textarea
                      rows={2}
                      value={logDesc}
                      onChange={e => setLogDesc(e.target.value)}
                      placeholder="Describe what you did and the result..."
                      className="w-full px-3 py-2 rounded-lg text-[12px] resize-none focus:outline-none"
                      style={{ backgroundColor: 'var(--ov-navy-card)', border: '1px solid var(--ov-border-md)', color: '#fff' }}
                    />
                  </div>

                  <div className="flex gap-2 mb-3">
                    <div className="flex-1">
                      <input
                        type="date"
                        value={logDate}
                        onChange={e => setLogDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-[12px] focus:outline-none"
                        style={{ backgroundColor: 'var(--ov-navy-card)', border: '1px solid var(--ov-border-md)', color: '#fff' }}
                      />
                    </div>
                    <div className="flex-1">
                      <select
                        value={logClass}
                        onChange={e => setLogClass(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-[12px] focus:outline-none"
                        style={{ backgroundColor: 'var(--ov-navy-card)', border: '1px solid var(--ov-border-md)', color: logClass ? '#fff' : 'var(--ov-text-dim)' }}
                      >
                        {ACTION_CLASSES.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => { setLogOpen(false); setLogError(null); setLogDesc(''); setLogClass('') }}
                      className="flex-1 py-1.5 rounded-lg text-[12px]"
                      style={{ border: '1px solid var(--ov-border-md)', color: 'var(--ov-text-mid)' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleLogAction}
                      disabled={logSaving || !logDesc.trim()}
                      className="flex-1 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50"
                      style={{ backgroundColor: 'var(--gold)', color: '#0a1628' }}
                    >
                      {logSaving ? 'Saving...' : 'Log action'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {active === 'Signals' && (() => {
          // Dependency, user_action belong in "What's affecting it" — not here.
          const feedSignals = signals.filter(s => s.signal_class !== 'dependency' && s.signal_class !== 'user_action')
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
