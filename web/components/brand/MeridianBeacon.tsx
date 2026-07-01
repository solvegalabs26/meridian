'use client'

import { useEffect, useState } from 'react'

interface MeridianBeaconProps {
  size?: number
  variant?: 'gold' | 'blue' | 'light'
  animate?: boolean
  launchSequence?: boolean
  arrowTip?: boolean
  className?: string
}

const VARIANTS = {
  gold:  { core: '#C9A227', needle: 'rgba(255,255,255,0.44)', tip: '#C9A227', ring: '#C9A227' },
  blue:  { core: '#2E7CB8', needle: 'rgba(255,255,255,0.44)', tip: '#C9A227', ring: '#2E7CB8' },
  light: { core: '#C9A227', needle: 'rgba(11,24,41,0.25)',    tip: '#C9A227', ring: '#C9A227' },
} as const

// Needle spans y1=52 to y2=10 in the 60x75 viewBox
const NEEDLE_LEN = 42

export default function MeridianBeacon({
  size = 40,
  variant = 'gold',
  animate = true,
  launchSequence = false,
  arrowTip = true,
  className,
}: MeridianBeaconProps) {
  const [phase, setPhase] = useState<'idle' | 'core' | 'needle' | 'settled'>(
    launchSequence ? 'idle' : 'settled'
  )
  const colors = VARIANTS[variant]

  useEffect(() => {
    if (!launchSequence) { setPhase('settled'); return }
    setPhase('idle')
    const t1 = setTimeout(() => setPhase('core'), 20)
    const t2 = setTimeout(() => setPhase('needle'), 440)
    const t3 = setTimeout(() => setPhase('settled'), 900)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [launchSequence])

  const showCore      = phase !== 'idle'
  const showNeedle     = phase === 'needle' || phase === 'settled'
  const showRings      = phase === 'settled'
  const corePopping    = launchSequence && phase === 'core'
  const needleDrawing  = launchSequence && phase === 'needle'

  return (
    <svg
      width={size}
      height={size * 1.25}
      viewBox="0 0 60 75"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ overflow: 'visible' }}
      aria-label="Meridian Arc beacon"
    >
      {/* Pulse rings */}
      {showRings && (
        <>
          <circle
            cx="30" cy="52" r="0" fill={colors.ring}
            style={{ animation: animate ? 'beaconRing1 2.5s ease-out 0.6s infinite' : 'none' }}
          />
          <circle
            cx="30" cy="52" r="0" fill={colors.ring}
            style={{ animation: animate ? 'beaconRing2 2.5s ease-out 1.2s infinite' : 'none' }}
          />
        </>
      )}

      {/* Glow halos */}
      <circle cx="30" cy="52" r="20" fill={colors.core} opacity="0.06" />
      <circle cx="30" cy="52" r="13" fill={colors.core} opacity="0.10" />

      {/* Core */}
      {showCore && (
        <circle
          cx="30" cy="52" r="8.5" fill={colors.core}
          style={corePopping ? {
            transformOrigin: '30px 52px',
            animation: 'beaconCorePop 0.42s cubic-bezier(0.34,1.56,0.64,1) forwards',
          } : undefined}
        />
      )}

      {/* North needle */}
      {showNeedle && (
        <line
          x1="30" y1="52" x2="30" y2="10"
          stroke={colors.needle} strokeWidth="1.8" strokeLinecap="round"
          strokeDasharray={NEEDLE_LEN}
          strokeDashoffset={needleDrawing ? NEEDLE_LEN : 0}
          style={needleDrawing ? { animation: 'beaconNeedleDraw 0.43s ease-out forwards' } : undefined}
        />
      )}

      {/* Arrow tip — chevron point, or dot when arrowTip is false */}
      {showNeedle && (
        arrowTip ? (
          <g style={{ animation: animate ? 'beaconTipBreath 2.4s ease-in-out infinite' : 'none' }}>
            <line x1="30" y1="8" x2="24" y2="16" stroke={colors.tip} strokeWidth="2.2" strokeLinecap="round" />
            <line x1="30" y1="8" x2="36" y2="16" stroke={colors.tip} strokeWidth="2.2" strokeLinecap="round" />
          </g>
        ) : (
          <circle
            cx="30" cy="10" r="3.5" fill={colors.tip}
            style={{ animation: animate ? 'beaconTipBreath 2.4s ease-in-out infinite' : 'none' }}
          />
        )
      )}
    </svg>
  )
}
