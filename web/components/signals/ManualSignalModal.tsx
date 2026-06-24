'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Objective } from '@/lib/utils/types'

interface ManualSignalModalProps {
  objectives: Pick<Objective, 'id' | 'title' | 'obj_id'>[]
  onClose: () => void
  onSaved: () => void
}

export default function ManualSignalModal({ objectives, onClose, onSaved }: ManualSignalModalProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [selectedObjectives, setSelectedObjectives] = useState<string[]>([])
  const [relevance, setRelevance] = useState('medium')
  const [signalType, setSignalType] = useState('neutral')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleObjective(id: string) {
    setSelectedObjectives(prev =>
      prev.includes(id) ? prev.filter(o => o !== id) : [...prev, id]
    )
  }

  async function handleSave() {
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError(null)

    const res = await fetch('/api/signals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        body: body.trim() || undefined,
        objective_ids: selectedObjectives,
        relevance,
        signal_type: signalType,
      }),
    })

    if (!res.ok) {
      const d = await res.json() as { error?: string }
      setError(d.error ?? 'Failed to save')
      setSaving(false)
      return
    }

    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <h2 className="text-[15px] font-semibold text-[var(--text)]">Add signal manually</h2>
          <button onClick={onClose} className="text-[var(--text3)] hover:text-[var(--text)] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-[var(--red-lt)] text-[var(--red)] text-[13px]">{error}</div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1.5">
              Signal title *
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Paste headline or describe the signal"
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--blue)]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1.5">
              Details / full text
            </label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={3}
              placeholder="Paste the full article, LinkedIn post, or any relevant text..."
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--blue)] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1.5">Relevance</label>
              <select
                value={relevance}
                onChange={e => setRelevance(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-[13px] bg-white focus:outline-none focus:border-[var(--blue)]"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1.5">Type</label>
              <select
                value={signalType}
                onChange={e => setSignalType(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-[13px] bg-white focus:outline-none focus:border-[var(--blue)]"
              >
                <option value="neutral">Signal</option>
                <option value="opportunity">Opportunity</option>
                <option value="risk">Risk</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1.5">
              Related objectives
            </label>
            <div className="flex flex-wrap gap-2">
              {objectives.map(obj => (
                <button
                  key={obj.id}
                  onClick={() => toggleObjective(obj.id)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                    selectedObjectives.includes(obj.id)
                      ? 'border-[var(--blue)] bg-[#E6F1FB] text-[var(--blue)] font-medium'
                      : 'border-[var(--border)] text-[var(--text2)] hover:border-[var(--blue-mid)]'
                  }`}
                >
                  {obj.obj_id}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-[var(--border)] text-[13px] text-[var(--text2)] hover:bg-[var(--gray-lt)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-navy text-white text-[13px] font-medium hover:bg-[var(--night)] transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Add signal'}
          </button>
        </div>
      </div>
    </div>
  )
}
