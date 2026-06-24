'use client'

import { useState } from 'react'
import { CheckCircle, X } from 'lucide-react'

interface DoNextActionsProps {
  topAction: string | null
  actions: string[]
}

export default function DoNextActions({ topAction, actions }: DoNextActionsProps) {
  const allActions = topAction
    ? [topAction, ...actions.filter(a => a !== topAction)]
    : actions

  const [completed, setCompleted] = useState<Set<number>>(new Set())
  const [activeForm, setActiveForm] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleComplete(i: number) {
    setSaving(true)
    const action = allActions[i]
    const weekNum = Math.max(1, Math.ceil(
      (Date.now() - new Date('2026-06-23').getTime()) / (7 * 24 * 60 * 60 * 1000)
    ))
    const getRes = await fetch(`/api/journal?week=${weekNum}`)
    const getData = await getRes.json() as { entry: { section_d?: { action: string; completed: boolean }[] } | null }
    const existing = getData.entry?.section_d ?? []

    await fetch('/api/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entry_number: weekNum,
        section_d: [...existing, {
          action: `[Dashboard] ${action}${notes ? ` — ${notes}` : ''}`,
          completed: true,
        }],
      }),
    })

    setCompleted(prev => new Set(Array.from(prev).concat(i)))
    setActiveForm(null)
    setNotes('')
    setSaving(false)
  }

  if (allActions.length === 0) return null

  return (
    <ul className="p-4 space-y-2">
      {allActions.slice(0, 4).map((action, i) => (
        <li key={i}>
          <div className={`flex gap-2 items-start rounded-lg px-1 py-1 transition-all ${
            completed.has(i) ? 'opacity-40' : 'hover:bg-[#E6F1FB]/60'
          }`}>
            <button
              onClick={() => !completed.has(i) && setActiveForm(i)}
              disabled={completed.has(i)}
              className={`flex-shrink-0 mt-0.5 transition-all ${
                completed.has(i)
                  ? 'text-[var(--green)] cursor-default'
                  : 'text-[var(--blue)] animate-pulse hover:animate-none hover:scale-125 cursor-pointer'
              }`}
              title={completed.has(i) ? 'Completed' : 'Click to mark complete'}
            >
              {completed.has(i)
                ? <CheckCircle size={15} />
                : <span className={`font-medium ${i === 0 ? 'text-[var(--text)]' : 'text-[var(--blue)]'}`}>
                    {i === 0 ? '→' : '·'}
                  </span>
              }
            </button>
            <span className={`text-[13px] leading-snug ${
              completed.has(i)
                ? 'line-through text-[var(--text3)]'
                : i === 0
                ? 'text-[var(--text)] font-medium'
                : 'text-[var(--text2)]'
            }`}>
              {action}
            </span>
          </div>

          {/* Completion form */}
          {activeForm === i && (
            <div className="mx-2 mt-2 bg-[#E6F1FB] border border-[var(--blue)]/20 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold text-[var(--blue)]">Log completion</p>
                <button onClick={() => setActiveForm(null)} className="text-[var(--text3)] hover:text-[var(--text)]">
                  <X size={13} />
                </button>
              </div>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional: what did you do / what was the outcome?"
                className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-[12px] resize-none focus:outline-none focus:border-[var(--blue)] mb-2"
              />
              <p className="text-[10px] text-[var(--text3)] mb-2">Saved to this week&apos;s journal → Section D.</p>
              <div className="flex gap-2">
                <button onClick={() => setActiveForm(null)}
                  className="flex-1 py-1.5 rounded-lg border border-[var(--border)] text-[11px] text-[var(--text2)] bg-white">
                  Cancel
                </button>
                <button
                  onClick={() => handleComplete(i)}
                  disabled={saving}
                  className="flex-1 py-1.5 rounded-lg bg-[var(--blue)] text-white text-[11px] font-medium disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  <CheckCircle size={11} />
                  {saving ? 'Saving...' : 'Mark complete'}
                </button>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
