interface SparklineScore {
  score: number
  created_at: string
}

interface SparklineBarProps {
  scores: SparklineScore[]
}

export default function SparklineBar({ scores }: SparklineBarProps) {
  if (scores.length === 0) return null

  const lastIndex = scores.length - 1

  return (
    <div className="flex items-end gap-3">
      <div className="flex items-end gap-1.5 h-16 flex-1">
        {scores.map((s, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm"
            style={{
              height: `${Math.max(4, s.score)}%`,
              backgroundColor: 'var(--blue)',
              opacity: i === lastIndex ? 1 : 0.35,
            }}
            title={`${s.score}% — ${new Date(s.created_at).toLocaleDateString()}`}
          />
        ))}
      </div>
      <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--ov-text-dim)' }}>
        {scores.length} week{scores.length !== 1 ? 's' : ''}
      </span>
    </div>
  )
}
