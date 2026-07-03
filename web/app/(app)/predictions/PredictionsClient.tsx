'use client'

import { useState } from 'react'
import { Plus, TrendingUp } from 'lucide-react'

interface Prediction {
  id: string
  pred_id: string | null
  statement: string
  confidence_pct: number
  horizon_date: string
  outcome: string | null
  accuracy_score: number | null
  scored_at: string | null
  notes: string | null
  objectives?: { obj_id: string; title: string } | null
}

interface Props {
  initialPredictions: Prediction[]
  objectives: { id: string; obj_id: string; title: string }[]
}

function getStatus(p: Prediction): 'open' | 'due' | 'scored' {
  if (p.scored_at) return 'scored'
  if (new Date(p.horizon_date) <= new Date()) return 'due'
  return 'open'
}

const STATUS_STYLES = {
  open:   'bg-[#E6F1FB] text-[var(--blue)]',
  due:    'bg-[var(--amber-lt)] text-[var(--amber-brand)]',
  scored: 'bg-[var(--green-lt)] text-[var(--green)]',
}

export default function PredictionsClient({ initialPredictions, objectives }: Props) {
  const [predictions, setPredictions] = useState(initialPredictions)
  const [showForm, setShowForm] = useState(false)
  const [scoringId, setScoringId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'due' | 'scored'>('all')

  // Form state
  const [statement, setStatement] = useState('')
  const [confidence, setConfidence] = useState(70)
  const [horizonDate, setHorizonDate] = useState('')
  const [objectiveId, setObjectiveId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Scoring state
  const [scoreOutcome, setScoreOutcome] = useState('')
  const [scoreRating, setScoreRating] = useState(3)

  const filtered = predictions.filter(p => filterStatus === 'all' || getStatus(p) === filterStatus)

  async function handleCreate() {
    if (!statement.trim() || !horizonDate) return
    setSaving(true)
    const res = await fetch('/api/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statement, confidence_pct: confidence, horizon_date: horizonDate, objective_id: objectiveId || undefined, notes: notes || undefined }),
    })
    if (res.ok) {
      const data = await res.json() as { prediction: Prediction }
      setPredictions(prev => [data.prediction, ...prev].sort((a, b) => new Date(a.horizon_date).getTime() - new Date(b.horizon_date).getTime()))
      setShowForm(false)
      setStatement(''); setConfidence(70); setHorizonDate(''); setObjectiveId(''); setNotes('')
    }
    setSaving(false)
  }

  async function handleScore(id: string) {
    const res = await fetch('/api/predictions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, outcome: scoreOutcome, accuracy_score: scoreRating }),
    })
    if (res.ok) {
      const data = await res.json() as { prediction: Prediction }
      setPredictions(prev => prev.map(p => p.id === id ? data.prediction : p))
      setScoringId(null)
      setScoreOutcome(''); setScoreRating(3)
    }
  }

  const dueCount = predictions.filter(p => getStatus(p) === 'due').length

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[22px] font-medium text-[var(--text)]">Prediction Log</h1>
          <p className="text-[13px] text-[var(--text3)] mt-0.5">
            {predictions.length} predictions · {dueCount} ready to score
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-navy text-white text-[13px] font-medium hover:bg-[var(--night)] transition-colors"
        >
          <Plus size={14} /> New prediction
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {(['all','open','due','scored'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`text-[12px] px-3 py-1.5 rounded-lg capitalize transition-colors ${filterStatus === s ? 'bg-navy text-white' : 'bg-white border border-[var(--border)] text-[var(--text2)] hover:border-[var(--blue-mid)]'}`}>
            {s === 'due' ? 'Ready to score' : s}
          </button>
        ))}
      </div>

      {/* New prediction form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-[var(--border)] p-5 mb-4">
          <h2 className="text-[14px] font-semibold text-[var(--text)] mb-4">New prediction</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1">Statement *</label>
              <textarea rows={2} value={statement} onChange={e => setStatement(e.target.value)}
                placeholder="By [date], [specific outcome] will happen..."
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-[13px] focus:outline-none focus:border-[var(--blue)] resize-none" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1">Confidence: {confidence}%</label>
                <input type="range" min={10} max={95} value={confidence} onChange={e => setConfidence(parseInt(e.target.value))} className="w-full" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1">Horizon date *</label>
                <input type="date" value={horizonDate} onChange={e => setHorizonDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-[16px] bg-white focus:outline-none focus:border-[var(--blue)]" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1">Objective</label>
                <select value={objectiveId} onChange={e => setObjectiveId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-[16px] bg-white focus:outline-none focus:border-[var(--blue)]">
                  <option value="">— None —</option>
                  {objectives.map(o => <option key={o.id} value={o.id}>{o.obj_id}</option>)}
                </select>
              </div>
            </div>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)"
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-[13px] focus:outline-none focus:border-[var(--blue)]" />
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg border border-[var(--border)] text-[13px] text-[var(--text2)] hover:bg-[var(--gray-lt)]">Cancel</button>
              <button onClick={handleCreate} disabled={saving || !statement.trim() || !horizonDate}
                className="flex-1 py-2 rounded-lg bg-navy text-white text-[13px] font-medium disabled:opacity-50">
                {saving ? 'Saving...' : 'Create prediction'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Predictions table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[var(--border)] p-12 text-center">
          <TrendingUp size={32} className="text-[var(--text3)] mx-auto mb-3" />
          <p className="text-[14px] font-medium text-[var(--text)] mb-1">No predictions yet</p>
          <p className="text-[13px] text-[var(--text3)]">Make a prediction about one of your objectives to start tracking accuracy.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[var(--border)] overflow-x-auto">
          <table className="w-full text-[13px] min-w-[520px]">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--gray-lt)]">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wider">ID</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wider">Statement</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wider w-16">Conf</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wider">Horizon</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const status = getStatus(p)
                return (
                  <tr key={p.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--gray-lt)/30]">
                    <td className="px-4 py-3 font-mono text-[11px] text-[var(--text3)]">{p.pred_id ?? '—'}</td>
                    <td className="px-4 py-3 text-[var(--text2)] max-w-xs">
                      <p className="line-clamp-2">{p.statement}</p>
                      {p.objectives && <p className="text-[11px] text-[var(--text3)] mt-0.5">{p.objectives.obj_id}</p>}
                      {p.accuracy_score && (
                        <div className="flex gap-0.5 mt-1">
                          {[1,2,3,4,5].map(s => (
                            <span key={s} className={`text-[11px] ${s <= p.accuracy_score! ? 'text-[var(--gold)]' : 'text-[var(--border)]'}`}>★</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-[var(--text)]">{p.confidence_pct}%</td>
                    <td className="px-4 py-3 text-[var(--text2)]">
                      {new Date(p.horizon_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      {status === 'due' ? (
                        <button onClick={() => { setScoringId(p.id); setScoreOutcome(''); setScoreRating(3) }}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES.due} hover:opacity-80`}>
                          Score now
                        </button>
                      ) : (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[status]}`}>
                          {status === 'scored' ? `Scored ${p.accuracy_score}/5` : 'Open'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Scoring modal */}
      {scoringId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setScoringId(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-[15px] font-semibold text-[var(--text)] mb-4">Score this prediction</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1">What actually happened?</label>
                <textarea rows={3} value={scoreOutcome} onChange={e => setScoreOutcome(e.target.value)}
                  placeholder="Describe the actual outcome..."
                  className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-[13px] focus:outline-none focus:border-[var(--blue)] resize-none" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-2">Accuracy (1–5)</label>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(s => (
                    <button key={s} onClick={() => setScoreRating(s)}
                      className={`text-[24px] transition-colors ${s <= scoreRating ? 'text-[var(--gold)]' : 'text-[var(--border)]'}`}>★</button>
                  ))}
                </div>
                <p className="text-[11px] text-[var(--text3)] mt-1">1 = Completely wrong · 5 = Exactly right</p>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setScoringId(null)} className="flex-1 py-2.5 rounded-lg border border-[var(--border)] text-[13px] text-[var(--text2)]">Cancel</button>
                <button onClick={() => handleScore(scoringId)} disabled={!scoreOutcome.trim()}
                  className="flex-1 py-2.5 rounded-lg bg-navy text-white text-[13px] font-medium disabled:opacity-50">
                  Submit score
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
