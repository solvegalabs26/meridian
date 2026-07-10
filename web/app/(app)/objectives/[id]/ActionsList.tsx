'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle, X, CalendarPlus, CalendarDays, Download } from 'lucide-react'
import { tierAtLeast } from '@/lib/tiers'
import { googleCalendarLink } from '@/lib/calendar/googleCalendarLink'

interface ActionsListProps {
  actions: string[]
  objId: string
  objectiveId: string
  tier: string
  hasCalendar: boolean
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

function asCompletedActionsArray(value: unknown): CompletedAction[] {
  if (!Array.isArray(value)) return []
  return value.filter((e): e is CompletedAction =>
    typeof e === 'object' && e !== null && typeof (e as CompletedAction).action === 'string'
  )
}

// "Tomorrow at 9 AM" in the user's local timezone, expressed as a UTC Date.
function tomorrowNineAm(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(9, 0, 0, 0)
  return d
}

function icsDownloadUrl(action: string): string {
  return `/api/calendar/ics?${new URLSearchParams({ title: action.slice(0, 200), duration: '30' })}`
}

const ICS_HELP = [
  {
    app: 'Google Calendar',
    steps: [
      'Go to calendar.google.com',
      'Click the gear icon → Settings → Import & Export → Import',
      'Select the downloaded file',
    ],
  },
  {
    app: 'Apple Calendar',
    steps: ['Double-click the downloaded .ics file — it opens directly.'],
  },
  {
    app: 'Outlook',
    steps: ['Double-click the file, or drag it onto your Outlook calendar.'],
  },
  {
    app: 'Other apps',
    steps: ['Most calendar apps support .ics import via File → Import.'],
  },
]

export default function ActionsList({ actions, objId, objectiveId, tier, hasCalendar }: ActionsListProps) {
  const [completed, setCompleted] = useState<Set<number>>(new Set())
  const [hovering, setHovering] = useState<number | null>(null)
  const [activeForm, setActiveForm] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [completedDate, setCompletedDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Calendar popover state
  const [openPopover, setOpenPopover] = useState<number | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Close popover on outside click or Escape
  useEffect(() => {
    if (openPopover === null) return
    function onMouseDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpenPopover(null)
        setHelpOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpenPopover(null)
        setHelpOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [openPopover])

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
        // Hydration failure → falls back to "not done" locally — nothing lost.
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
      // Log engine-recommended action completion into objective_actions
      fetch(`/api/objectives/${objectiveId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: action,
          action_date: completedDate || new Date().toISOString().split('T')[0],
          source: 'engine_recommended',
        }),
      }).catch(() => { /* non-fatal */ })
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

  const isAcceleratorPlus = tierAtLeast({ tier, account_type: null }, 'accelerator')

  return (
    <div>
      <ul className="space-y-2">
        {actions.map((action, i) => {
          const badge = priorityBadge(i)
          const isDone = completed.has(i)
          const isPopoverOpen = openPopover === i

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
                  {isAcceleratorPlus ? (
                    <div
                      className="relative"
                      ref={isPopoverOpen ? popoverRef : undefined}
                    >
                      <button
                        onClick={() => {
                          setOpenPopover(isPopoverOpen ? null : i)
                          setHelpOpen(false)
                        }}
                        title="Add to Calendar"
                        className="p-1 rounded-lg transition-colors"
                        style={{ color: isPopoverOpen ? 'var(--blue-mid)' : 'var(--ov-text-dim)' }}
                        onMouseEnter={e => { if (!isPopoverOpen) e.currentTarget.style.color = 'var(--blue-mid)' }}
                        onMouseLeave={e => { if (!isPopoverOpen) e.currentTarget.style.color = 'var(--ov-text-dim)' }}
                      >
                        <CalendarPlus size={13} />
                      </button>

                      {isPopoverOpen && (
                        <div
                          className="absolute right-0 top-7 z-50 rounded-xl shadow-xl"
                          style={{
                            width: 220,
                            backgroundColor: '#1a2744',
                            border: '1px solid rgba(46,124,184,0.3)',
                            color: '#E8EDF5',
                          }}
                        >
                          <div className="p-3">
                            {hasCalendar ? (
                              <>
                                {/* Primary: Google Calendar deep-link */}
                                <button
                                  onClick={() => {
                                    window.open(
                                      googleCalendarLink({ title: action.slice(0, 200), start: tomorrowNineAm() }),
                                      '_blank'
                                    )
                                    setOpenPopover(null)
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[12px] font-medium text-left transition-colors"
                                  style={{ backgroundColor: 'rgba(46,124,184,0.18)' }}
                                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(46,124,184,0.30)')}
                                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(46,124,184,0.18)')}
                                >
                                  {/* Google Calendar colour-block icon */}
                                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                    <rect width="16" height="16" rx="2" fill="#fff"/>
                                    <rect x="0" y="6" width="16" height="10" rx="0" fill="#fff"/>
                                    <rect x="0" y="0" width="16" height="6" rx="2" fill="#4285F4"/>
                                    <rect x="0" y="4" width="16" height="2" fill="#4285F4"/>
                                    <rect x="4" y="0" width="2" height="4" rx="1" fill="#fff"/>
                                    <rect x="10" y="0" width="2" height="4" rx="1" fill="#fff"/>
                                    <text x="8" y="14" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#4285F4">G</text>
                                  </svg>
                                  Add to Google Calendar
                                </button>

                                <p className="mt-1.5 px-1 text-[10px] leading-snug" style={{ color: '#8A9BB5' }}>
                                  Opens in your active Google account. If you have multiple Google accounts, make sure you&apos;re signed into the right one in this browser.
                                </p>

                                {/* Secondary: .ics download */}
                                <a
                                  href={icsDownloadUrl(action)}
                                  className="block mt-2 text-center text-[11px] py-1 rounded"
                                  style={{ color: 'rgba(232,237,245,0.45)' }}
                                  onMouseEnter={e => (e.currentTarget.style.color = 'rgba(232,237,245,0.75)')}
                                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(232,237,245,0.45)')}
                                  onClick={() => setOpenPopover(null)}
                                >
                                  Download .ics file
                                </a>
                              </>
                            ) : (
                              <>
                                {/* Primary: .ics download */}
                                <a
                                  href={icsDownloadUrl(action)}
                                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[12px] font-medium"
                                  style={{ backgroundColor: 'rgba(46,124,184,0.18)', color: '#E8EDF5' }}
                                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(46,124,184,0.30)')}
                                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(46,124,184,0.18)')}
                                  onClick={() => setOpenPopover(null)}
                                >
                                  <Download size={13} />
                                  Download .ics file
                                </a>

                                {/* Collapsible help */}
                                <button
                                  onClick={() => setHelpOpen(h => !h)}
                                  className="w-full mt-2 text-left text-[10px] px-1 py-1 flex items-center justify-between"
                                  style={{ color: 'rgba(232,237,245,0.45)' }}
                                >
                                  <span>Don&apos;t know what to do with this?</span>
                                  <span>{helpOpen ? '▲' : '▼'}</span>
                                </button>

                                {helpOpen && (
                                  <div
                                    className="mt-2 rounded-lg px-3 py-2.5 space-y-3 text-[10px]"
                                    style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(46,124,184,0.15)' }}
                                  >
                                    <p className="font-semibold" style={{ color: '#E8EDF5' }}>How to add this to your calendar:</p>
                                    {ICS_HELP.map(({ app, steps }) => (
                                      <div key={app}>
                                        <p className="font-medium mb-0.5" style={{ color: 'rgba(232,237,245,0.8)' }}>{app}</p>
                                        {steps.map((step, si) => (
                                          <p key={si} style={{ color: 'rgba(232,237,245,0.55)' }}>
                                            {steps.length > 1 ? `${si + 1}. ` : ''}{step}
                                          </p>
                                        ))}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      disabled
                      title="Upgrade to Accelerator to export actions to your calendar"
                      className="p-1 rounded-lg opacity-30 cursor-not-allowed"
                      style={{ color: 'var(--ov-text-dim)' }}
                    >
                      <CalendarDays size={13} />
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
                      placeholder="e.g. 'Listed on RV Trader at $49,500' — logging this updates your confidence score right now."
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
