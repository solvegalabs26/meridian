'use client'

import { useState } from 'react'
import { Signal } from '@/lib/utils/types'
import { ExternalLink } from 'lucide-react'

const RELEVANCE_COLORS = {
  high:   { dot: '#0F6E56', bg: 'bg-[var(--green-lt)]', text: 'text-[var(--green)]' },
  medium: { dot: '#2E7CB8', bg: 'bg-[#E6F1FB]',         text: 'text-[var(--blue)]' },
  low:    { dot: '#8098B4', bg: 'bg-[var(--gray-lt)]',   text: 'text-[var(--text3)]' },
}

const TYPE_LABELS: Record<string, string> = {
  opportunity: 'Opportunity',
  risk:        'Risk',
  cross_dep:   'Cross-objective',
  neutral:     'Signal',
}

export default function SignalCard({ signal }: { signal: Signal }) {
  const [expanded, setExpanded] = useState(false)
  const [read, setRead] = useState(signal.is_read)

  const rel = RELEVANCE_COLORS[signal.relevance as keyof typeof RELEVANCE_COLORS] ?? RELEVANCE_COLORS.medium

  async function handleClick() {
    setExpanded(!expanded)
    if (!read) {
      setRead(true)
      await fetch('/api/signals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: signal.id, is_read: true }),
      })
    }
  }

  return (
    <div
      onClick={handleClick}
      className={`bg-white rounded-xl border cursor-pointer transition-all hover:shadow-sm ${
        signal.is_cross_dep
          ? 'border-[var(--amber-brand)]/40 hover:border-[var(--amber-brand)]'
          : read
          ? 'border-[var(--border)] opacity-75'
          : 'border-[var(--border)] hover:border-[var(--blue-mid)]'
      }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Relevance dot */}
          <div
            className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
            style={{ backgroundColor: rel.dot }}
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {signal.is_cross_dep && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--amber-lt)] text-[var(--amber-brand)]">
                  ⇄ Cross-objective
                </span>
              )}
              {!signal.is_cross_dep && signal.signal_type && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${rel.bg} ${rel.text}`}>
                  {TYPE_LABELS[signal.signal_type] ?? signal.signal_type}
                </span>
              )}
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--gray-lt)] text-[var(--text3)] capitalize">
                {signal.source_type ?? 'signal'}
              </span>
              {!read && (
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--blue)] flex-shrink-0" />
              )}
            </div>

            <p className={`text-[13.5px] leading-snug ${read ? 'text-[var(--text2)]' : 'text-[var(--text)] font-medium'}`}>
              {signal.title}
            </p>

            {expanded && signal.body && (
              <p className="text-[12.5px] text-[var(--text2)] mt-2 leading-relaxed">
                {signal.body}
              </p>
            )}

            <div className="flex items-center gap-3 mt-2">
              {signal.source && (
                <a
                  href={signal.source.startsWith('http') ? signal.source : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="flex items-center gap-1 text-[11px] text-[var(--text3)] hover:text-[var(--blue)] transition-colors"
                >
                  <ExternalLink size={10} />
                  {signal.source_type === 'news' ? 'Source' : signal.source.slice(0, 40)}
                </a>
              )}
              <span className="text-[11px] text-[var(--text3)]">
                {new Date(signal.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
