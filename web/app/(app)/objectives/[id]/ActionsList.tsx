'use client'

import { useState } from 'react'
import { CheckCircle, X } from 'lucide-react'

interface ActionsListProps {
  actions: string[]
  objId: string
}

export default function ActionsList({ actions, objId }: ActionsListProps) {
  const [completed, setCompleted] = useState<Set<number>>(new Set())
  const [hovering, setHovering] = useState<number | null>(null)
  const [activeForm, setActiveForm] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [completedDate, setCompletedDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  async function handleComplete(i: number) {
    setSaving(true)
    const action = actions[i]
    const weekNum = Math.max(1, Math.ceil(
      (Date.now() - new Date('2026-06-23').getTime()) / (7 * 24 * 60 * 60 * 1000)
    ))

    const getRes = await fetch(`/api/journal?week=${weekNum}`)
    const getData = await getRes.json() as { entry: { section_d?: { action: string; completed: boolean }[] } | null }
    const existingD = getData.entry?.section_d ?? []

    const entryText = [
      `[${objId}] ${action}`,
      completedDate ? `Completed: ${completedDate}` : '',
      notes.trim() ? notes.trim() : '',
    ].filter(Boolean).join(' — ')

    await fetch('/api/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entry_number: weekNum,
        section_d: [...existingD, { action: entryText, completed: true }],
      }),
    })

    setCompleted(prev => new Set(Array.from(prev).concat(i)))
    setActiveForm(null)
    setNotes('')
    setCompletedDate(new Date().toISOString().split('T')[0])
    setSaving(false)
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

                {isDone ? (
                  <button
                    onClick={() => { setCompleted(prev => new Set(Array.from(prev).filter(n => n !== i))); setHovering(null) }}
                    onMouseEnter={() => setHovering(i)}
                    onMouseLeave={() => setHovering(null)}
                    className="flex-shrink-0 text-[11px] font-medium flex items-center gap-1"
                    style={{ color: hovering === i ? 'var(--ov-amber)' : 'var(--ov-green)' }}
                  >
                    {hovering === i ? 'Undo' : <><CheckCircle size={13} /> Done</>}
                  </button>
                ) : (
                  <button
                    onClick={() => setActiveForm(activeForm === i ? null : i)}
                    className="flex-shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-lg"
                    style={{ border: '1px solid var(--ov-border-md)', color: 'var(--ov-text-mid)' }}
                  >
                    Mark done
                  </button>
                )}
              </div>

              {activeForm === i && (
                <div className="ml-2 mt-2 rounded-xl p-4" style={{ backgroundColor: 'rgba(46,124,184,0.08)', border: '1px solid rgba(46,124,184,0.2)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[12px] font-semibold" style={{ color: 'var(--blue-mid)' }}>Log completion</p>
                    <button onClick={() => setActiveForm(null)} style={{ color: 'var(--ov-text-dim)' }}>
                      <X size={14} />
                    </button>
                  </div>

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
                    Saved to Week {Math.max(1, Math.ceil((Date.now() - new Date('2026-06-23').getTime()) / (7 * 24 * 60 * 60 * 1000)))} journal → Section D.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setActiveForm(null)}
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
                      {saving ? 'Saving...' : 'Mark complete'}
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
