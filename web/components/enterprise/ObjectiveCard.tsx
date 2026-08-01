'use client'

import { useState } from 'react'
import type { ObjectiveWithResult, ObjectiveState, LiteTrend } from '@/lib/enterprise/objectives-queries'

type Props = {
  objective: ObjectiveWithResult
  onStateChange: (objectiveId: string, newState: ObjectiveState) => void
  changingState: boolean
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}

function confidenceBadge(score: number) {
  const pct = Math.round(score * 100)
  if (score >= 0.75) return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-900/40 text-green-400">{pct}%</span>
  )
  if (score >= 0.50) return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-400">{pct}%</span>
  )
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-900/30 text-red-400">{pct}%</span>
  )
}

function trendBadge(trend: LiteTrend | null) {
  switch (trend) {
    case 'improving':    return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-900/40 text-green-400">▲ Improving</span>
    case 'deteriorating': return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-900/30 text-red-400">▼ Deteriorating</span>
    case 'stable':       return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-900/30 text-yellow-400">→ Stable</span>
    default:             return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-800 text-gray-500">— Unknown</span>
  }
}

// Highlight TC-A001 / LN-001 style refs in gold monospace
function HighlightRefs({ text }: { text: string }) {
  const parts = text.split(/\b(TC-[A-Z]\d+|LN-\d+)\b/g)
  return (
    <span>
      {parts.map((part, i) =>
        /^(TC-[A-Z]\d+|LN-\d+)$/.test(part)
          ? <span key={i} className="font-mono text-yellow-400 text-[11px] bg-yellow-400/10 px-1 py-0.5 rounded">{part}</span>
          : <span key={i}>{part}</span>
      )}
    </span>
  )
}

// Detect and render numbered list from text
function NumberedText({ text }: { text: string }) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const items = lines.filter(l => /^\d+[.)]\s/.test(l))
  if (items.length >= 2) {
    return (
      <ol className="space-y-2.5">
        {items.map((item, i) => {
          const content = item.replace(/^\d+[.)]\s*/, '')
          return (
            <li key={i} className="flex gap-3 text-sm text-gray-300 leading-relaxed">
              <span className="font-bold text-yellow-400 flex-shrink-0 tabular-nums">{i + 1}.</span>
              <span>{content}</span>
            </li>
          )
        })}
      </ol>
    )
  }
  return <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{text}</p>
}

function AccordionSection({
  label, open, onToggle, children,
}: {
  label: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border-t border-gray-800/70">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-800/30 transition"
      >
        <span className="text-xs font-semibold text-yellow-500/80 tracking-wide uppercase">{label}</span>
        <span className="text-gray-600 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  )
}

// ── FOCUS CARD ────────────────────────────────────────────────────────────────

function FocusCard({ objective, onStateChange, changingState }: Props) {
  const { latest_result: r } = objective
  const [open, setOpen] = useState({ affecting_it: true, implies: false, signals: false, what_to_do: false })
  const [menuOpen, setMenuOpen] = useState(false)

  const toggle = (key: keyof typeof open) => setOpen(prev => ({ ...prev, [key]: !prev[key] }))

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-base flex-shrink-0">🎯</span>
          <span className="text-xs font-mono font-bold text-yellow-400 flex-shrink-0">{objective.obj_id}</span>
          <span className="font-semibold text-sm text-white truncate" style={{ fontFamily: 'EB Garamond, Georgia, serif' }}>
            {objective.title}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {r && confidenceBadge(r.confidence_score)}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="text-gray-500 hover:text-gray-300 text-lg leading-none px-1 transition"
            >
              ⋯
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-6 z-10 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 w-48">
                <button
                  className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 transition"
                  onClick={() => { setMenuOpen(false); onStateChange(objective.id, 'monitoring_lite') }}
                  disabled={changingState}
                >
                  Move to Monitoring Lite
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 transition"
                  onClick={() => { setMenuOpen(false); onStateChange(objective.id, 'paused') }}
                  disabled={changingState}
                >
                  Pause
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alert banner */}
      {r?.alert_triggered && (
        <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-amber-900/20 border border-amber-700/40 flex items-center gap-2">
          <span className="text-amber-400 text-sm">⚠</span>
          <span className="text-xs font-semibold text-amber-400">Alert — threshold crossed · action recommended</span>
        </div>
      )}

      {/* Empty state */}
      {!r && (
        <div className="px-4 pb-4 text-sm text-gray-500">
          <p className="mb-1 text-gray-400 text-xs">{objective.statement}</p>
          <p className="text-xs text-gray-600">No sweep data yet — run a portfolio sweep to generate intelligence for this objective.</p>
        </div>
      )}

      {/* POS sections */}
      {r && (
        <>
          <AccordionSection label="What is affecting it" open={open.affecting_it} onToggle={() => toggle('affecting_it')}>
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{r.affecting_it ?? '—'}</p>
          </AccordionSection>
          <AccordionSection label="What this implies" open={open.implies} onToggle={() => toggle('implies')}>
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{r.implies ?? '—'}</p>
          </AccordionSection>
          <AccordionSection label="Signals" open={open.signals} onToggle={() => toggle('signals')}>
            <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
              {r.signals ? <HighlightRefs text={r.signals} /> : '—'}
            </div>
          </AccordionSection>
          <AccordionSection label="What to do" open={open.what_to_do} onToggle={() => toggle('what_to_do')}>
            {r.what_to_do ? <NumberedText text={r.what_to_do} /> : <p className="text-sm text-gray-500">—</p>}
          </AccordionSection>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between">
            <span className="text-xs text-gray-600">Last sweep {timeAgo(r.computed_at)}</span>
            <div className="flex gap-2">
              <button
                onClick={() => onStateChange(objective.id, 'monitoring_lite')}
                disabled={changingState}
                className="text-xs px-3 py-1 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition disabled:opacity-40"
              >
                Move to Monitoring Lite
              </button>
              <button
                onClick={() => onStateChange(objective.id, 'paused')}
                disabled={changingState}
                className="text-xs px-3 py-1 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition disabled:opacity-40"
              >
                Pause
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── MONITORING LITE CARD ──────────────────────────────────────────────────────

function LiteCard({ objective, onStateChange, changingState }: Props) {
  const { latest_result: r } = objective

  const nextSweep = (() => {
    const base = objective.last_lite_sweep_at ?? objective.last_focus_sweep_at
    if (!base || !objective.lite_sweep_cadence_days) return 'Not scheduled'
    const next = new Date(new Date(base).getTime() + objective.lite_sweep_cadence_days * 86400000)
    return next.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })()

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base flex-shrink-0">📡</span>
          <span className="text-xs font-mono font-bold text-yellow-400 flex-shrink-0">{objective.obj_id}</span>
          <span className="font-semibold text-sm text-white truncate" style={{ fontFamily: 'EB Garamond, Georgia, serif' }}>
            {objective.title}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {r && trendBadge(r.lite_trend ?? null)}
          <span className="text-xs text-gray-600">{timeAgo(r?.computed_at ?? null)}</span>
        </div>
      </div>

      {r ? (
        <>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {[
              { label: r.lite_metric_1_label, value: r.lite_metric_1_value },
              { label: r.lite_metric_2_label, value: r.lite_metric_2_value },
            ].map((m, i) => (
              <div key={i} className="bg-gray-800/60 rounded-lg px-3 py-2">
                <div className="text-xs text-gray-500 mb-1">{m.label ?? 'Metric'}</div>
                <div className="text-base font-bold text-white">{m.value ?? '—'}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 leading-relaxed mb-1">
            {r.lite_summary ?? 'No summary available — run a sweep to generate.'}
          </p>
        </>
      ) : (
        <p className="text-xs text-gray-600 mb-3">No sweep data yet — run a portfolio sweep to generate intelligence for this objective.</p>
      )}

      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-gray-700">Next lite sweep: {nextSweep}</span>
        <div className="flex gap-2">
          <button
            onClick={() => onStateChange(objective.id, 'focus')}
            disabled={changingState}
            className="text-xs px-3 py-1 rounded-lg border border-yellow-800/50 text-yellow-600 hover:text-yellow-400 hover:border-yellow-700 transition disabled:opacity-40"
          >
            Escalate to Focus
          </button>
          <button
            onClick={() => onStateChange(objective.id, 'paused')}
            disabled={changingState}
            className="text-xs px-3 py-1 rounded-lg border border-gray-700 text-gray-500 hover:text-gray-300 transition disabled:opacity-40"
          >
            Pause
          </button>
        </div>
      </div>
    </div>
  )
}

// ── PAUSED CARD ───────────────────────────────────────────────────────────────

function PausedCard({ objective, onStateChange, changingState }: Props) {
  return (
    <div className="bg-gray-900/40 border border-gray-800/50 rounded-xl p-3 flex items-center justify-between opacity-60">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm">⏸</span>
        <span className="text-xs font-mono text-gray-600">{objective.obj_id}</span>
        <span className="text-sm text-gray-500 truncate" style={{ fontFamily: 'EB Garamond, Georgia, serif' }}>
          {objective.title}
        </span>
      </div>
      <button
        onClick={() => onStateChange(objective.id, 'focus')}
        disabled={changingState}
        className="flex-shrink-0 text-xs px-3 py-1 rounded-lg border border-gray-700 text-gray-500 hover:text-gray-300 transition disabled:opacity-40 ml-3"
      >
        Reactivate → Focus
      </button>
    </div>
  )
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────

export function ObjectiveCard(props: Props) {
  switch (props.objective.objective_state) {
    case 'focus':           return <FocusCard {...props} />
    case 'monitoring_lite': return <LiteCard {...props} />
    case 'paused':          return <PausedCard {...props} />
  }
}
