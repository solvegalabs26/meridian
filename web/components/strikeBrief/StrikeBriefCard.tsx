'use client'

import { useEffect, useState } from 'react'

interface StrikeBriefRow {
  id: string
  brief_date: string
  time_window: string
  domain: string
  synthesis: string
  lead_signal: string | null
  go_no_go: string | null
  condition_delta: string | null
  pattern_match_year: number | null
  confidence_tier: string | null
  agent_hits: string[]
  created_at: string
}

interface Props {
  objectiveId: string
  domain: string
}

const GO_NO_GO_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  GO:          { label: 'GO',          bg: 'rgba(74,222,128,.15)', color: '#4ade80' },
  NO_GO:       { label: 'NO GO',       bg: 'rgba(200,90,84,.15)',  color: '#C85A54' },
  CONDITIONAL: { label: 'CONDITIONAL', bg: 'rgba(201,162,39,.15)', color: '#C9A227' },
  MONITOR:     { label: 'MONITOR',     bg: 'rgba(96,165,250,.15)', color: '#60a5fa' },
}

const TIER_COLOR: Record<string, string> = {
  T1: '#4ade80',
  T2: '#60a5fa',
  T3: '#C9A227',
  T4: 'rgba(255,255,255,.35)',
}

export default function StrikeBriefCard({ objectiveId, domain }: Props) {
  const [brief, setBrief]   = useState<StrikeBriefRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    if (domain !== 'elk_hunt') { setLoading(false); return }

    fetch(`/api/strike-brief?objectiveId=${encodeURIComponent(objectiveId)}`)
      .then(res => res.ok ? res.json() as Promise<StrikeBriefRow> : Promise.reject(res.statusText))
      .then(data => { setBrief(data); setLoading(false) })
      .catch(err => { setError(String(err)); setLoading(false) })
  }, [objectiveId, domain])

  if (domain !== 'elk_hunt') return null
  if (loading) {
    return (
      <div className="rounded-xl p-4 mt-4" style={{ border: '1px solid var(--ov-border)', backgroundColor: 'var(--ov-navy-card)' }}>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--ov-blue)' }} />
          <span className="text-[12px]" style={{ color: 'var(--ov-text-dim)' }}>Loading strike brief…</span>
        </div>
      </div>
    )
  }
  if (error || !brief) return null

  const gng = brief.go_no_go ? (GO_NO_GO_STYLE[brief.go_no_go] ?? GO_NO_GO_STYLE.MONITOR) : null
  const tierColor = brief.confidence_tier ? (TIER_COLOR[brief.confidence_tier] ?? TIER_COLOR.T4) : TIER_COLOR.T4

  return (
    <div
      className="rounded-xl p-4 mt-4 flex flex-col gap-3"
      style={{ border: '1px solid var(--ov-border-md)', backgroundColor: 'var(--ov-navy-card)' }}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase"
          style={{ backgroundColor: 'rgba(96,165,250,.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,.3)' }}
        >
          {brief.time_window}
        </span>
        {gng && (
          <span
            className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase"
            style={{ backgroundColor: gng.bg, color: gng.color }}
          >
            {gng.label}
          </span>
        )}
        <span className="text-[10px] ml-auto" style={{ color: 'var(--ov-text-dim)' }}>
          STRIKE BRIEF · {brief.brief_date}
        </span>
      </div>

      {/* Lead signal */}
      {brief.lead_signal && (
        <div
          className="px-3 py-2 rounded-lg text-[12px] font-medium leading-snug"
          style={{ backgroundColor: 'rgba(201,162,39,.1)', border: '1px solid rgba(201,162,39,.25)', color: '#C9A227' }}
        >
          {brief.lead_signal}
        </div>
      )}

      {/* Synthesis */}
      <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ov-text-mid)' }}>
        {brief.synthesis}
      </p>

      {/* Condition delta */}
      {brief.condition_delta && (
        <p className="text-[12px] italic" style={{ color: 'var(--ov-text-dim)' }}>
          Delta: {brief.condition_delta}
        </p>
      )}

      {/* Footer row */}
      <div className="flex items-center gap-3 flex-wrap pt-1" style={{ borderTop: '1px solid var(--ov-border)' }}>
        {brief.pattern_match_year && (
          <span className="text-[11px]" style={{ color: 'var(--ov-text-dim)' }}>
            Pattern: {brief.pattern_match_year}
          </span>
        )}
        {brief.confidence_tier && (
          <span className="text-[11px] font-semibold" style={{ color: tierColor }}>
            {brief.confidence_tier}
          </span>
        )}
        {brief.agent_hits.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap ml-auto">
            {brief.agent_hits.map(key => (
              <span
                key={key}
                className="px-1.5 py-0.5 rounded text-[9px] font-mono"
                style={{ backgroundColor: 'rgba(96,165,250,.1)', color: 'rgba(96,165,250,.7)', border: '1px solid rgba(96,165,250,.2)' }}
              >
                {key}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
