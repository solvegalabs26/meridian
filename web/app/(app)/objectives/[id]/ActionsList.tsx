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

  return (
    <div>
      <p className="text-[11px] text-[var(--text3)] mb-3 italic">
        Click → to mark an action complete — it will be logged to your journal.
      </p>
      <ul className="space-y-2">
        {actions.map((action, i) => (
          <li key={i}>
            <div className={`flex gap-2.5 items-start rounded-lg p-2 transition-all ${
              completed.has(i)
                ? hovering === i ? 'opacity-70 bg-[var(--amber-lt)]' : 'opacity-40'
                : 'hover:bg-[var(--gray-lt)]'
            }`}>
              <button
                onClick={() => {
                  if (completed.has(i)) {
                    setCompleted(prev => new Set(Array.from(prev).filter(n => n !== i)))
                    setHovering(null)
                  } else {
                    setActiveForm(activeForm === i ? null : i)
                  }
                }}
                onMouseEnter={() => completed.has(i) && setHovering(i)}
                onMouseLeave={() => setHovering(null)}
                className={`flex-shrink-0 mt-0.5 font-medium text-[16px] leading-none transition-all ${
                  completed.has(i)
                    ? 'cursor-pointer'
                    : 'text-[var(--blue)] animate-pulse hover:animate-none hover:scale-125 cursor-pointer'
                }`}
                title={completed.has(i) ? 'Click to undo' : 'Click to mark complete'}
              >
                {completed.has(i)
                  ? hovering === i
                    ? <span className="text-[10px] font-semibold text-[var(--amber-brand)] whitespace-nowrap">Undo</span>
                    : <CheckCircle size={16} className="text-[var(--green)]" />
                  : '→'
                }
              </button>
              <span
                onClick={() => !completed.has(i) && setActiveForm(activeForm === i ? null : i)}
                className={`text-[13px] leading-relaxed cursor-pointer ${
                  completed.has(i) ? 'line-through text-[var(--text3)]' : 'text-[var(--text2)]'
                }`}
              >
                {action}
              </span>
            </div>

            {activeForm === i && (
              <div className="ml-7 mt-2 bg-[#E6F1FB] border border-[var(--blue)]/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[12px] font-semibold text-[var(--blue)]">Log completion</p>
                  <button onClick={() => setActiveForm(null)} className="text-[var(--text3)] hover:text-[var(--text)]">
                    <X size={14} />
                  </button>
                </div>

                <div className="mb-3">
                  <label className="block text-[10px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1">Date completed</label>
                  <input
                    type="date"
                    value={completedDate}
                    onChange={e => setCompletedDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-[12px] bg-white focus:outline-none focus:border-[var(--blue)]"
                  />
                </div>

                <div className="mb-3">
                  <label className="block text-[10px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1">What did you do? What was the outcome?</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Describe what you did and the result..."
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-[12px] resize-none focus:outline-none focus:border-[var(--blue)]"
                  />
                </div>

                <p className="text-[10px] text-[var(--text3)] mb-3">
                  Saved to Week {Math.max(1, Math.ceil((Date.now() - new Date('2026-06-23').getTime()) / (7 * 24 * 60 * 60 * 1000)))} journal → Section D.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setActiveForm(null)}
                    className="flex-1 py-1.5 rounded-lg border border-[var(--border)] text-[12px] text-[var(--text2)] bg-white">
                    Cancel
                  </button>
                  <button
                    onClick={() => handleComplete(i)}
                    disabled={saving}
                    className="flex-1 py-1.5 rounded-lg bg-[var(--blue)] text-white text-[12px] font-medium disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle size={12} />
                    {saving ? 'Saving...' : 'Mark complete'}
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
