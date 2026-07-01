interface SweepStoryCardProps {
  type: 'risk' | 'opportunity' | 'insight' | 'action'
  title: string
  body: string
  objectiveName: string
  confidenceDelta?: number
  source?: string
  deadline?: string
}

const TYPE_STYLES: Record<SweepStoryCardProps['type'], { border: string; badgeBg: string; badgeColor: string; label: string }> = {
  risk:        { border: 'rgba(192,64,42,0.22)',  badgeBg: 'rgba(192,64,42,0.14)',  badgeColor: 'var(--ov-red)',   label: '⚠ Risk' },
  opportunity: { border: 'rgba(58,153,80,0.18)',  badgeBg: 'rgba(58,153,80,0.14)',  badgeColor: 'var(--ov-green)', label: '↑ Opportunity' },
  insight:     { border: 'rgba(46,124,184,0.18)', badgeBg: 'rgba(46,124,184,0.14)', badgeColor: 'var(--blue-mid)', label: '◎ Insight' },
  action:      { border: 'rgba(201,162,39,0.18)', badgeBg: 'rgba(201,162,39,0.14)', badgeColor: 'var(--gold)',     label: '→ Do this' },
}

export default function SweepStoryCard({ type, title, body, objectiveName, confidenceDelta, source, deadline }: SweepStoryCardProps) {
  const style = TYPE_STYLES[type]

  return (
    <div
      className="rounded-2xl p-4"
      style={{ backgroundColor: 'var(--ov-navy-card)', border: `1px solid ${style.border}` }}
    >
      <span
        className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2"
        style={{ color: style.badgeColor, backgroundColor: style.badgeBg }}
      >
        {style.label}
      </span>

      <p className="text-[14px] font-semibold mb-1" style={{ color: 'var(--ov-text-hi)' }}>
        {title}
      </p>
      <p className="text-[12px] leading-[1.6]" style={{ color: 'var(--ov-text-mid)' }}>
        {body}
      </p>

      <div className="flex items-center justify-between mt-3 pt-2 flex-wrap gap-1" style={{ borderTop: '1px solid var(--ov-border)' }}>
        <span className="text-[11px]" style={{ color: 'var(--ov-text-dim)' }}>
          Affects {objectiveName}
          {source && ` · ${source}`}
          {deadline && ` · ${deadline}`}
        </span>
        {confidenceDelta !== undefined && confidenceDelta !== 0 && (
          <span
            className="text-[11px] font-medium"
            style={{ color: confidenceDelta > 0 ? 'var(--ov-green)' : 'var(--ov-red)' }}
          >
            {confidenceDelta > 0 ? '↑' : '↓'} {Math.abs(confidenceDelta)}
          </span>
        )}
      </div>
    </div>
  )
}
