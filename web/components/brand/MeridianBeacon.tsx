'use client'

import { useEffect, useState } from 'react'

interface MeridianBeaconProps {
  size?: number
  variant?: 'gold' | 'blue' | 'light'
  animate?: boolean
  launchSequence?: boolean
  arrowTip?: boolean
}

const COLORS = {
  gold:  '#C9A227',
  blue:  '#2E7CB8',
  light: '#C9A227',
}

export default function MeridianBeacon({
  size = 40,
  variant = 'gold',
  animate = true,
  launchSequence = false,
  arrowTip = true,
}: MeridianBeaconProps) {
  const [phase, setPhase] = useState<'idle' | 'core' | 'needle' | 'rings' | 'sparkles' | 'pulse'>('idle')

  const color      = COLORS[variant]
  const cx         = size / 2
  const cy         = size / 2
  const coreR      = size * 0.12
  const needleLen  = size * 0.26
  const arrowSize  = size * 0.065
  const needleY1   = cy - coreR - 1
  const needleY2   = cy - coreR - needleLen
  const ring1R     = size * 0.30
  const ring2R     = size * 0.44
  const uid        = `mb${size}${variant}`

  useEffect(() => {
    if (!launchSequence) { setPhase('pulse'); return }
    setPhase('core')
    const t1 = setTimeout(() => setPhase('needle'),   420)
    const t2 = setTimeout(() => setPhase('rings'),    850)
    const t3 = setTimeout(() => setPhase('sparkles'), 1150)
    const t4 = setTimeout(() => setPhase('pulse'),    1700)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [launchSequence])

  const shouldAnimate  = animate && (phase === 'pulse' || !launchSequence)
  const showCore       = !launchSequence || phase !== 'idle'
  const showNeedle     = !launchSequence || ['needle','rings','sparkles','pulse'].includes(phase)
  const showRings      = !launchSequence || ['rings','sparkles','pulse'].includes(phase)
  const showSparkles   = phase === 'sparkles'

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: 'visible' }}
      aria-label="Meridian beacon"
    >
      <style>{`
        @keyframes ${uid}-r1 {
          0%,100% { transform: scale(0.88); opacity: 0.55; }
          55%      { transform: scale(1.18); opacity: 0.10; }
        }
        @keyframes ${uid}-r2 {
          0%,100% { transform: scale(0.88); opacity: 0.28; }
          55%      { transform: scale(1.18); opacity: 0.05; }
        }
        @keyframes ${uid}-pop {
          0%   { transform: scale(0); opacity: 0; }
          65%  { transform: scale(1.28); opacity: 1; }
          82%  { transform: scale(0.88); }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes ${uid}-draw {
          0%   { stroke-dashoffset: ${needleLen}; opacity: 0; }
          25%  { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes ${uid}-burst {
          0%   { transform: scale(0.3); opacity: 0.9; }
          100% { transform: scale(2.8); opacity: 0; }
        }
        @keyframes ${uid}-spark {
          0%   { opacity: 1; }
          100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0.2); }
        }
      `}</style>

      {/* Pulse ring 1 */}
      {showRings && (
        <circle
          cx={cx} cy={cy} r={ring1R}
          stroke={color} strokeWidth={size * 0.028} fill="none"
          style={shouldAnimate ? {
            transformOrigin: `${cx}px ${cy}px`,
            animation: `${uid}-r1 2.4s ease-in-out infinite`,
          } : { opacity: 0.45 }}
        />
      )}

      {/* Pulse ring 2 */}
      {showRings && (
        <circle
          cx={cx} cy={cy} r={ring2R}
          stroke={color} strokeWidth={size * 0.018} fill="none"
          style={shouldAnimate ? {
            transformOrigin: `${cx}px ${cy}px`,
            animation: `${uid}-r2 2.4s ease-in-out 0.55s infinite`,
          } : { opacity: 0.20 }}
        />
      )}

      {/* Launch burst rings */}
      {phase === 'rings' && [0, 0.14].map((delay, i) => (
        <circle key={i}
          cx={cx} cy={cy} r={coreR}
          stroke={color} strokeWidth={size * 0.03} fill="none"
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            animation: `${uid}-burst 0.55s ease-out ${delay}s forwards`,
          }}
        />
      ))}

      {/* Sparkles */}
      {showSparkles && [
        { tx:  size * 0.24, ty: -size * 0.24 },
        { tx: -size * 0.24, ty: -size * 0.24 },
        { tx:  size * 0.24, ty:  size * 0.24 },
        { tx: -size * 0.24, ty:  size * 0.24 },
      ].map((d, i) => (
        <circle key={i}
          cx={cx} cy={cy} r={size * 0.042} fill={color}
          style={{
            ['--tx' as string]: `${d.tx}px`,
            ['--ty' as string]: `${d.ty}px`,
            animation: `${uid}-spark 0.55s ease-out ${i * 0.06}s forwards`,
          }}
        />
      ))}

      {/* Needle line */}
      {showNeedle && (
        <line
          x1={cx} y1={needleY1} x2={cx} y2={needleY2}
          stroke={color}
          strokeWidth={size * 0.048}
          strokeLinecap="round"
          strokeDasharray={needleLen}
          strokeDashoffset={launchSequence && phase === 'needle' ? needleLen : 0}
          style={launchSequence && phase === 'needle' ? {
            animation: `${uid}-draw 0.45s ease-out forwards`,
          } : {}}
        />
      )}

      {/* Arrow tip at north point */}
      {showNeedle && arrowTip && (
        <polygon
          points={`
            ${cx},${needleY2 - arrowSize}
            ${cx - arrowSize * 0.72},${needleY2 + arrowSize * 0.55}
            ${cx + arrowSize * 0.72},${needleY2 + arrowSize * 0.55}
          `}
          fill={color}
        />
      )}

      {/* Core */}
      {showCore && (
        <circle
          cx={cx} cy={cy} r={coreR} fill={color}
          style={launchSequence && phase === 'core' ? {
            transformOrigin: `${cx}px ${cy}px`,
            animation: `${uid}-pop 0.42s cubic-bezier(0.34,1.56,0.64,1) forwards`,
          } : {}}
        />
      )}
    </svg>
  )
}
