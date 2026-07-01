interface HeadlineObjective {
  id: string
  title: string
  confidence: number
  confidence_prev: number | null
}

interface HeadlineCardProps {
  objectives: HeadlineObjective[]
  hasSweep: boolean
}

export default function HeadlineCard({ objectives, hasSweep }: HeadlineCardProps) {
  const deltas = objectives
    .filter(o => o.confidence_prev !== null)
    .map(o => ({ ...o, delta: o.confidence - (o.confidence_prev as number) }))

  const needsAttention = deltas
    .filter(o => o.delta < -5)
    .sort((a, b) => a.delta - b.delta)[0]

  const headline = !hasSweep
    ? 'Meridian Arc is ready to scan your goals.'
    : needsAttention
      ? `${needsAttention.title} needs attention.`
      : 'Your goals are on track.'

  return (
    <div
      className="rounded-[20px] p-5"
      style={{
        backgroundColor: 'var(--ov-navy-card)',
        border: '1px solid var(--ov-border-md)',
        borderTop: '2px solid var(--gold)',
      }}
    >
      <p
        className="text-[9px] uppercase tracking-widest font-semibold mb-2"
        style={{ color: 'var(--blue-mid)' }}
      >
        Your week
      </p>
      <p
        style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 22, lineHeight: 1.25, color: 'var(--ov-text-hi)' }}
      >
        {headline}
      </p>

      {deltas.length > 0 && (
        <p className="text-[12px] mt-3 flex flex-wrap gap-x-3 gap-y-1">
          {deltas.map(o => (
            <span key={o.id} style={{ color: o.delta >= 0 ? 'var(--ov-green)' : 'var(--ov-red)' }}>
              {o.title} {o.delta >= 0 ? '↑' : '↓'}{Math.abs(o.delta)}
            </span>
          ))}
        </p>
      )}
    </div>
  )
}
