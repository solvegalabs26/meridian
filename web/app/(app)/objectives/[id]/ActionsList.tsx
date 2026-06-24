'use client'

import { useState } from 'react'
import { CheckCircle, X } from 'lucide-react'

interface ActionsListProps {
  actions: string[]
  objId: string
}

interface CompletionForm {
  action: string
  notes: string
  saving: boolean
}

export default function ActionsList({ actions, objId }: ActionsListProps) {
  const [completed, setCompleted] = useState<Set<number>>(new Set())
  const [activeForm, setActiveForm] = useState<number | null>(null)
  const [form, setForm] = useState<CompletionForm>({ action: '', notes: '', saving: false })

  function openForm(i: number) {
    setActiveForm(i)
    setForm({ action: actions[i], notes: '', saving: false })
  }

  async function handleComplete(i: number) {
    setForm(f => ({ ...f, saving: true }))

    // Save to journal section D for the current week
    const weekNum = Math.max(1, Math.ceil(
      (Date.now() - new Date('2026-06-23').getTime()) / (7 * 24 * 60 * 60 * 1000)
    ))

    // Fetch existing journal entry
    const getRes = await fetch(`/api/journal?week=${weekNum}`)
    const getData = await getRes.json() as { entry: { section_d?: { action: string; completed: boolean }[] } | null }
    const existingD = getData.entry?.section_d ?? []

    // Add new completed action
    const updatedD = [
      ...existingD,
      { action: `[${objId}] ${form.action}${form.notes ? ` — ${form.notes}` : ''}`, completed: true },
    ]

    await fetch('/api/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entry_number: weekNum,
        section_d: updatedD,
      }),
    })

    setCompleted(prev => new Set(Array.from(prev).concat(i)))
    setActiveForm(null)
    setForm({ action: '', notes: '', saving: false })
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
            <div className={`flex gap-2.5 items-start rounded-lg p-2.5 transition-all ${
              completed.has(i) ? 'opacity-50' : 'hover:bg-[var(--gray-lt)]'
            }`}>
              <button
                onClick={() => !completed.has(i) && openForm(i)}
                disabled={completed.has(i)}
                className={`flex-shrink-0 mt-0.5 transition-all ${
                  completed.has(i)
                    ? 'text-[var(--green)]'
                    : 'text-[var(--blue)] animate-pulse hover:animate-none hover:scale-125 cursor-pointer'
                }`}
                title={completed.has(i) ? 'Completed' : 'Click to mark complete'}
              >
                {completed.has(i) ? (
                  <CheckCircle size={16} />
                ) : (
                  <span className="text-[16px] leading-none">→</span>
                )}
              </button>
              <span className={`text-[13px] leading-relaxed ${
                completed.has(i) ? 'line-through text-[var(--text3)]' : 'text-[var(--text2)]'
              }`}>
                {action}
              </span>
            </div>

            {/* Completion form */}
            {activeForm === i && (
              <div className="ml-7 mt-2 bg-[#E6F1FB] border border-[var(--blue)]/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[12px] font-semibold text-[var(--blue)]">Log completion</p>
                  <button onClick={() => setActiveForm(null)} className="text-[var(--text3)] hover:text-[var(--text)]">
                    <X size={14} />
                  </button>
                </div>
                <p className="text-[12px] text-[var(--text2)] mb-3 line-clamp-2">{action}</p>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional: what did you do / what was the outcome?"
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-[12px] resize-none focus:outline-none focus:border-[var(--blue)] mb-3"
                />
                <p className="text-[10px] text-[var(--text3)] mb-3">
                  This will be saved to Week {Math.max(1, Math.ceil((Date.now() - new Date('2026-06-23').getTime()) / (7 * 24 * 60 * 60 * 1000)))} journal → Section D (Actions taken).
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveForm(null)}
                    className="flex-1 py-1.5 rounded-lg border border-[var(--border)] text-[12px] text-[var(--text2)] bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleComplete(i)}
                    disabled={form.saving}
                    className="flex-1 py-1.5 rounded-lg bg-[var(--blue)] text-white text-[12px] font-medium disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle size={12} />
                    {form.saving ? 'Saving...' : 'Mark complete'}
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
