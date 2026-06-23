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
  gold: '#C9A227',
  blue: '#2E7CB8',
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

  const color = COLORS[variant]
  const cx = size / 2
  const cy = size / 2
  const coreR = size * 0.12
  const ring1R = size * 0.28
  const ring2R = size * 0.42
  const needleLen = size * 0.32
  const needleY1 = cy - coreR - 1
  const needleY2 = cy - coreR - needleLen
  const arrowSize = size * 0.07

  // Launch sequence state machine
  useEffect(() => {
    if (!launchSequence) {
      setPhase('pulse')
      return
    }
    setPhase('core')
    const t1 = setTimeout(() => setPhase('needle'), 420)
    const t2 = setTimeout(() => setPhase('rings'), 850)
    const t3 = setTimeout(() => setPhase('sparkles'), 1150)
    const t4 = setTimeout(() => setPhase('pulse'), 1700)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [launchSequence])

  const shouldAnimate = animate && (phase === 'pulse' || (!launchSequence && animate))
  const showCore = !launchSequence || phase !== 'idle'
  const showNeedle = !launchSequence || ['needle', 'rings', 'sparkles', 'pulse'].includes(phase)
  const showRings = !launchSequence || ['rings', 'sparkles', 'pulse'].includes(phase)
  const showSparkles = phase === 'sparkles'

  const uid = `beacon-${size}-${variant}`

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Meridian beacon"
    >
      <style>{`
        @keyframes ${uid}-ring1-pulse {
          0%   { r: ${ring1R * 0.85}; opacity: 0.55; }
          60%  { r: ${ring1R * 1.15}; opacity: 0.12; }
          100% { r: ${ring1R * 0.85}; opacity: 0.55; }
        }
        @keyframes ${uid}-ring2-pulse {
          0%   { r: ${ring2R * 0.85}; opacity: 0.30; }
          60%  { r: ${ring2R * 1.15}; opacity: 0.06; }
          100% { r: ${ring2R * 0.85}; opacity: 0.30; }
        }
        @keyframes ${uid}-core-pop {
          0%   { transform: scale(0); opacity: 0; }
          60%  { transform: scale(1.25); opacity: 1; }
          80%  { transform: scale(0.9); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes ${uid}-needle-draw {
          0%   { stroke-dashoffset: ${needleLen}; opacity: 0; }
          30%  { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes ${uid}-rings-burst {
          0%   { r: ${coreR}; opacity: 0.8; }
          100% { r: ${ring2R * 1.3}; opacity: 0; }
        }
        @keyframes ${uid}-sparkle {
          0%   { opacity: 1; transform: translate(0,0) scale(1); }
          100% { opacity: 0; transform: translate(var(--tx),var(--ty)) scale(0.3); }
        }
      `}</style>

      {/* Pulse rings */}
      {showRings && (
        <>
          <circle
            cx={cx}
            cy={cy}
            r={ring1R}
            stroke={color}
            strokeWidth={size * 0.025}
            fill="none"
            opacity={shouldAnimate ? undefined : 0.45}
            style={shouldAnimate ? {
              animation: `${uid}-ring1-pulse 2.4s ease-in-out infinite`,
            } : {}}
          />
          <circle
            cx={cx}
            cy={cy}
            r={ring2R}
            stroke={color}
            strokeWidth={size * 0.018}
            fill="none"
            opacity={shouldAnimate ? undefined : 0.22}
            style={shouldAnimate ? {
              animation: `${uid}-ring2-pulse 2.4s ease-in-out 0.55s infinite`,
            } : {}}
          />
        </>
      )}

      {/* Launch burst rings */}
      {phase === 'rings' && (
        <>
          <circle cx={cx} cy={cy} r={coreR} stroke={color} strokeWidth={size * 0.03} fill="none"
            style={{ animation: `${uid}-rings-burst 0.5s ease-out forwards` }} />
          <circle cx={cx} cy={cy} r={coreR} stroke={color} strokeWidth={size * 0.02} fill="none"
            style={{ animation: `${uid}-rings-burst 0.5s ease-out 0.12s forwards` }} />
        </>
      )}

      {/* Sparkles at ±45° diagonals */}
      {showSparkles && (() => {
        const d = size * 0.22
        const dirs = [
          { tx: d, ty: -d }, { tx: -d, ty: -d },
          { tx: d, ty: d },  { tx: -d, ty: d },
        ]
        return dirs.map((dir, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={size * 0.04}
            fill={color}
            style={{
              ['--tx' as string]: `${dir.tx}px`,
              ['--ty' as string]: `${dir.ty}px`,
              animation: `${uid}-sparkle 0.55s ease-out ${i * 0.06}s forwards`,
            }}
          />
        ))
      })()}

      {/* Needle */}
      {showNeedle && (
        <line
          x1={cx}
          y1={needleY1}
          x2={cx}
          y2={needleY2}
          stroke={color}
          strokeWidth={size * 0.045}
          strokeLinecap="round"
          strokeDasharray={needleLen}
          strokeDashoffset={launchSequence && phase === 'needle' ? needleLen : 0}
          style={launchSequence && phase === 'needle' ? {
            animation: `${uid}-needle-draw 0.45s ease-out forwards`,
          } : {}}
        />
      )}

      {/* Arrow tip at north point */}
      {showNeedle && arrowTip && (
        <polygon
          points={`
            ${cx},${needleY2 - arrowSize}
            ${cx - arrowSize * 0.7},${needleY2 + arrowSize * 0.5}
            ${cx + arrowSize * 0.7},${needleY2 + arrowSize * 0.5}
          `}
          fill={color}
          opacity={launchSequence && phase === 'needle' ? 0 : 1}
          style={launchSequence && phase === 'needle' ? {
            animation: `${uid}-needle-draw 0.45s ease-out forwards`,
          } : {}}
        />
      )}

      {/* Core */}
      {showCore && (
        <circle
          cx={cx}
          cy={cy}
          r={coreR}
          fill={color}
          style={launchSequence && phase === 'core' ? {
            transformOrigin: `${cx}px ${cy}px`,
            animation: `${uid}-core-pop 0.42s cubic-bezier(0.34,1.56,0.64,1) forwards`,
          } : {}}
        />
      )}
    </svg>
  )
}
