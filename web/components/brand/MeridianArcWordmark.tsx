'use client'

import MeridianBeacon from './MeridianBeacon'

interface MeridianArcWordmarkProps {
  size?: 'sm' | 'md' | 'lg'
  showSub?: boolean
  animate?: boolean
  launchSequence?: boolean
  orientation?: 'horizontal' | 'stacked'
  className?: string
}

const SIZE_MAP = {
  sm: { beacon: 28, wordmark: 19, sub: 8 },
  md: { beacon: 44, wordmark: 26, sub: 10 },
  lg: { beacon: 72, wordmark: 40, sub: 13 },
} as const

export default function MeridianArcWordmark({
  size = 'md',
  showSub = true,
  animate = true,
  launchSequence = false,
  orientation = 'horizontal',
  className,
}: MeridianArcWordmarkProps) {
  const dims = SIZE_MAP[size]
  const stacked = orientation === 'stacked'

  return (
    <div
      className={`flex items-center ${stacked ? 'flex-col text-center' : 'flex-row'} ${stacked ? 'gap-2' : 'gap-3'} ${className ?? ''}`}
    >
      <MeridianBeacon size={dims.beacon} variant="gold" animate={animate} launchSequence={launchSequence} arrowTip={true} />
      <div>
        <div
          style={{
            fontFamily: "'EB Garamond', Georgia, serif",
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: dims.wordmark,
            lineHeight: 1.1,
            color: '#fff',
          }}
        >
          meridian arc
        </div>
        {showSub && (
          <div
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontWeight: 400,
              fontSize: dims.sub,
              letterSpacing: '0.1em',
              color: '#5090C0',
              marginTop: 2,
            }}
          >
            by Solvega Labs
          </div>
        )}
      </div>
    </div>
  )
}
