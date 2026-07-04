'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, X, CalendarPlus } from 'lucide-react'
import { tierAtLeast } from '@/lib/tiers'

interface ActionsListProps {
  actions: string[]
  objId: string
  tier: string
}

function currentWeekNum() {
  return Math.max(1, Math.ceil(
    (Date.now() - new Date('2026-06-23').getTime()) / (7 * 24 * 60 * 60 * 1000)
  ))
}

interface CompletedAction {
  action: string
  completed: boolean
}

// journal_entries.completed_actions is a jsonb column dedicated to this
// feature — nothing else writes to it, unlike section_d (narrative
// concerns/questions/key insight) or section_c (a separate manual action
// log). Still validate the shape defensively, since jsonb is untyped at
// the DB level.
function asCompletedActionsArray(value: unknown): CompletedAction[] {
  if (!Array.isArray(value)) return []
  return value.filter((e): e is CompletedAction =>
    typeof e === 'object' && e !== null && typeof (e as CompletedAction).action === 'string'
  )
}

function handleAddToCalendar(action: string) {
  const params = new URLSearchParams({
    title: action.slice(0, 200),
    duration: '30',
  })
  // Trigger .ics download
  window.location.href = `/api/calendar/ics?${params.toString()}`
}

export default function ActionsList({ actions, objId, tier }: ActionsListProps) {
  const [completed, setCompleted] = useState<Set<number>>(new Set())
  const [hovering, setHovering] = useState<number | null>(null)
  const [activeForm, setActiveForm] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [completedDate, setCompletedDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Hydrate completed state from this week's journal entry — otherwise a
  // genuinely successful save looks unpersisted after navigating away and
  // back, since `completed` would otherwise only ever reflect this mount.
  useEffect(() => {
    let cancelled = false

    async function hydrate() {
      try {
        const res = await fetch(`/api/journal?week=${currentWeekNum()}`)
        if (!res.ok) return
        const data = await res.json() as { entry: { completed_actions?: unknown } | null }
        const entries = asCompletedActionsArray(data.entry?.completed_actions)
        const doneIndices = new Set<number>()
        actions.forEach((action, i) => {
          const prefix = `[${objId}] ${action}`
          if (entries.some(e => e.completed && e.action.startsWith(prefix))) {
            doneIndices.add(i)
          }
        })
        if (!cancelled) setCompleted(doneIndices)
      } catch {
        // Hydration failing just means we fall back to "not done" locally —
        // not worth surfacing as an error, nothing was lost.
      }
    }

    hydrate()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleComplete(i: number) {
    setSaving(true)
    setSaveError(null)

    try {
      const action = actions[i]
      const weekNum = currentWeekNum()

      const getRes = await fetch(`/api/journal?week=${weekNum}`)
      if (!getRes.ok) throw new Error('Could not load your journal — please try again.')
      const getData = await getRes.json() as { entry: { completed_actions?: unknown } | null }
      const existingActions = asCompletedActionsArray(getData.entry?.completed_actions)

      const entryText = [
        `[${objId}] ${action}`,
        completedDate ? `Completed: ${completedDate}` : '',
        notes.trim() ? notes.trim() : '',
      ].filter(Boolean).join(' — ')

      const postRes = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_number: weekNum,
          completed_actions: [...existingActions, { action: entryText, completed: true }],
        }),
      })
      if (!postRes.ok) {
        const errBody = await postRes.json().catch(() => null) as { error?: string } | null
        throw new Error(errBody?.error ?? 'Could not save — please try again.')
      }

      setCompleted(prev => new Set(Array.from(prev).concat(i)))
      setActiveForm(null)
      setNotes('')
      setCompletedDate(new Date().toISOString().split('T')[0])
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong — please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (actions.length === 0) return null

  function priorityBadge(i: number) {
    if (i === 0) return { label: 'Do this week', bg: 'rgba(201,162,39,0.14)', color: 'var(--gold)' }
    if (i === 1) return { label: 'This month', bg: 'rgba(46,124,184,0.14)', color: 'var(--blue-mid)' }
    return { label: 'Monitor', bg: 'rgba(255,255,255,0.06)', color: 'var(--ov-text-dim)' }
  }

  return (
    <div>
      <ul className="space-y-2">
        {actions.map((action, i) => {
          const badge = priorityBadge(i)
          const isDone = completed.has(i)

          return (
            <li key={i}>
              <div className="flex gap-2.5 items-start rounded-lg p-2.5" style={{ opacity: isDone ? 0.5 : 1 }}>
                <span
                  className="text-[9px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 whitespace-nowrap"
                  style={{ backgroundColor: badge.bg, color: badge.color }}
                >
                  {badge.label}
                </span>

                <span
                  className="text-[12px] leading-relaxed flex-1"
                  style={{ color: 'var(--ov-text-hi)', textDecoration: isDone ? 'line-through' : 'none' }}
                >
                  {action}
                </span>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isDone ? (
                    <button
                      onClick={() => { setCompleted(prev => new Set(Array.from(prev).filter(n => n !== i))); setHovering(null) }}
                      onMouseEnter={() => setHovering(i)}
                      onMouseLeave={() => setHovering(null)}
                      className="text-[11px] font-medium flex items-center gap-1"
                      style={{ color: hovering === i ? 'var(--ov-amber)' : 'var(--ov-green)' }}
                    >
                      {hovering === i ? 'Undo' : <><CheckCircle size={13} /> Done</>}
                    </button>
                  ) : (
                    <button
                      onClick={() => { setActiveForm(activeForm === i ? null : i); setSaveError(null) }}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-lg"
                      style={{ border: '1px solid var(--ov-border-md)', color: 'var(--ov-text-mid)' }}
                    >
                      Mark done
                    </button>
                  )}

                  {/* Add to Calendar — Accelerator+ only */}
                  {tierAtLeast({ tier, account_type: null }, 'accelerator') ? (
                    <button
                      onClick={() => handleAddToCalendar(action)}
                      title="Add to Calendar"
                      className="p-1 rounded-lg transition-colors"
                      style={{ color: 'var(--ov-text-dim)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--blue-mid)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--ov-text-dim)')}
                    >
                      <CalendarPlus size={13} />
                    </button>
                  ) : (
                    <button
                      disabled
                      title="Upgrade to Accelerator to export actions to your calendar"
                      className="p-1 rounded-lg opacity-30 cursor-not-allowed"
                      style={{ color: 'var(--ov-text-dim)' }}
                    >
                      <CalendarPlus size={13} />
                    </button>
                  )}
                </div>
              </div>

              {activeForm === i && (
                <div className="ml-2 mt-2 rounded-xl p-4" style={{ backgroundColor: 'rgba(46,124,184,0.08)', border: '1px solid rgba(46,124,184,0.2)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[12px] font-semibold" style={{ color: 'var(--blue-mid)' }}>Log completion</p>
                    <button onClick={() => { setActiveForm(null); setSaveError(null) }} style={{ color: 'var(--ov-text-dim)' }}>
                      <X size={14} />
                    </button>
                  </div>

                  {saveError && (
                    <div
                      className="mb-3 px-3 py-2 rounded-lg text-[11px]"
                      style={{ backgroundColor: 'rgba(192,64,42,0.14)', color: 'var(--ov-red)' }}
                    >
                      {saveError}
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--ov-text-mid)' }}>Date completed</label>
                    <input
                      type="date"
                      value={completedDate}
                      onChange={e => setCompletedDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-[12px] focus:outline-none"
                      style={{ backgroundColor: 'var(--ov-navy-card)', border: '1px solid var(--ov-border-md)', color: '#fff' }}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--ov-text-mid)' }}>What did you do? What was the outcome?</label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Describe what you did and the result..."
                      className="w-full px-3 py-2 rounded-lg text-[12px] resize-none focus:outline-none"
                      style={{ backgroundColor: 'var(--ov-navy-card)', border: '1px solid var(--ov-border-md)', color: '#fff' }}
                    />
                  </div>

                  <p className="text-[10px] mb-3" style={{ color: 'var(--ov-text-dim)' }}>
                    Logged to your Week {currentWeekNum()} completed actions.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => { setActiveForm(null); setSaveError(null) }}
                      className="flex-1 py-1.5 rounded-lg text-[12px]"
                      style={{ border: '1px solid var(--ov-border-md)', color: 'var(--ov-text-mid)' }}>
                      Cancel
                    </button>
                    <button
                      onClick={() => handleComplete(i)}
                      disabled={saving}
                      className="flex-1 py-1.5 rounded-lg text-white text-[12px] font-medium disabled:opacity-50 flex items-center justify-center gap-1.5"
                      style={{ backgroundColor: 'var(--blue)' }}
                    >
                      <CheckCircle size={12} />
                      {saving ? 'Saving...' : saveError ? 'Retry' : 'Mark complete'}
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
