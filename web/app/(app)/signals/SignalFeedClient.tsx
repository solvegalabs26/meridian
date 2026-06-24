'use client'

import { useState, useMemo } from 'react'
import { Plus, Radio } from 'lucide-react'
import SignalCard from '@/components/signals/SignalCard'
import ManualSignalModal from '@/components/signals/ManualSignalModal'
import { Signal } from '@/lib/utils/types'

interface Props {
  initialSignals: Signal[]
  objectives: { id: string; title: string; obj_id: string }[]
}

export default function SignalFeedClient({ initialSignals, objectives }: Props) {
  const [signals, setSignals] = useState<Signal[]>(initialSignals)
  const [showModal, setShowModal] = useState(false)
  const [filterObjective, setFilterObjective] = useState('all')
  const [filterRelevance, setFilterRelevance] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterUnread, setFilterUnread] = useState(false)

  const filtered = useMemo(() => {
    return signals.filter(s => {
      if (filterObjective !== 'all' && !s.objective_ids?.includes(filterObjective)) return false
      if (filterRelevance !== 'all' && s.relevance !== filterRelevance) return false
      if (filterType !== 'all' && s.signal_type !== filterType) return false
      if (filterUnread && s.is_read) return false
      return true
    })
  }, [signals, filterObjective, filterRelevance, filterType, filterUnread])

  const unreadCount = signals.filter(s => !s.is_read).length
  const crossDepCount = signals.filter(s => s.is_cross_dep).length

  async function handleSaved() {
    // Refresh signals
    const res = await fetch('/api/signals')
    if (res.ok) {
      const data = await res.json() as { signals: Signal[] }
      setSignals(data.signals)
    }
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-medium text-[var(--text)]">Signal Feed</h1>
          <p className="text-[13px] text-[var(--text3)] mt-0.5">
            {signals.length} signals · {unreadCount} unread · {crossDepCount} cross-objective
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-navy text-white text-[13px] font-medium hover:bg-[var(--night)] transition-colors"
        >
          <Plus size={14} />
          Add signal
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-3 mb-4 flex flex-wrap gap-2 items-center">
        <select
          value={filterObjective}
          onChange={e => setFilterObjective(e.target.value)}
          className="text-[12px] px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-white text-[var(--text2)] focus:outline-none focus:border-[var(--blue)]"
        >
          <option value="all">All objectives</option>
          {objectives.map(o => (
            <option key={o.id} value={o.id}>{o.obj_id} — {o.title}</option>
          ))}
        </select>

        <select
          value={filterRelevance}
          onChange={e => setFilterRelevance(e.target.value)}
          className="text-[12px] px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-white text-[var(--text2)] focus:outline-none focus:border-[var(--blue)]"
        >
          <option value="all">All relevance</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="text-[12px] px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-white text-[var(--text2)] focus:outline-none focus:border-[var(--blue)]"
        >
          <option value="all">All types</option>
          <option value="opportunity">Opportunity</option>
          <option value="risk">Risk</option>
          <option value="cross_dep">Cross-objective</option>
          <option value="neutral">Signal</option>
        </select>

        <label className="flex items-center gap-1.5 text-[12px] text-[var(--text2)] cursor-pointer ml-1">
          <input
            type="checkbox"
            checked={filterUnread}
            onChange={e => setFilterUnread(e.target.checked)}
            className="w-3.5 h-3.5 rounded"
          />
          Unread only
        </label>

        {(filterObjective !== 'all' || filterRelevance !== 'all' || filterType !== 'all' || filterUnread) && (
          <button
            onClick={() => { setFilterObjective('all'); setFilterRelevance('all'); setFilterType('all'); setFilterUnread(false) }}
            className="text-[11px] text-[var(--text3)] hover:text-[var(--text)] ml-auto"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Signal list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[var(--border)] p-12 text-center">
          <Radio size={32} className="text-[var(--text3)] mx-auto mb-3" />
          <p className="text-[14px] font-medium text-[var(--text)] mb-1">No signals yet</p>
          <p className="text-[13px] text-[var(--text3)]">
            {signals.length === 0
              ? 'Run a sweep to pull in news signals, or add one manually.'
              : 'No signals match your current filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(signal => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      )}

      {showModal && (
        <ManualSignalModal
          objectives={objectives}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
