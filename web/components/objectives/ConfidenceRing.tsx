import { STATUS_COLORS, type ConfidenceStatus } from '@/lib/utils/confidenceStatus'

interface ConfidenceRingProps {
  confidence: number
  size?: number
  status: ConfidenceStatus
  delta?: number
  previousScore?: number
}

const RADIUS = 50
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const GRADIENT_ID = 'confidence-ring-watch-gradient'

export default function ConfidenceRing({ confidence, size = 120, status, delta, previousScore }: ConfidenceRingProps) {
  const offset = CIRCUMFERENCE * (1 - confidence / 100)
  const strokeColor = status === 'watch' ? `url(#${GRADIENT_ID})` : STATUS_COLORS[status]

  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 120 120">
        <defs>
          <linearGradient id={GRADIENT_ID} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--ov-amber)" />
            <stop offset="100%" stopColor="var(--gold)" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
        <circle
          cx="60" cy="60" r={RADIUS} fill="none"
          stroke={strokeColor}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[28px] font-bold leading-none" style={{ color: status === 'watch' ? '#fff' : STATUS_COLORS[status] }}>
          {confidence}<span className="text-[16px]">%</span>
        </span>
        {delta !== undefined && previousScore !== undefined && (
          <span
            className="text-[11px] font-medium mt-1"
            style={{ color: delta >= 0 ? 'var(--ov-green)' : 'var(--ov-red)' }}
          >
            {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)} from {previousScore}
          </span>
        )}
      </div>
    </div>
  )
}
