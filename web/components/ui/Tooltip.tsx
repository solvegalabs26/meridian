'use client'

import { useState, useRef, useEffect } from 'react'
import { HelpCircle } from 'lucide-react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  term: string
  definition: string
  children?: React.ReactNode
  iconSize?: number
}

export default function Tooltip({ term, definition, children, iconSize = 13 }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0, below: false })
  const btnRef = useRef<HTMLButtonElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  function show() {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const below = rect.top < 200
    setCoords({
      top: below ? rect.bottom + 8 : rect.top - 8,
      left: rect.left + rect.width / 2,
      below,
    })
    setVisible(true)
  }

  const tooltip = visible && mounted ? createPortal(
    <div
      style={{
        position: 'fixed',
        top: coords.below ? coords.top : undefined,
        bottom: coords.below ? undefined : `calc(100vh - ${coords.top}px)`,
        left: coords.left,
        transform: 'translateX(-50%)',
        zIndex: 9999,
        width: 288,
        pointerEvents: 'none',
      }}
    >
      <div className="bg-[#0D1B2A] text-white rounded-xl shadow-2xl p-4">
        <p className="text-[11px] font-semibold text-[#C9A227] uppercase tracking-wider mb-1.5">{term}</p>
        <p className="text-[12.5px] leading-relaxed text-white/80">{definition}</p>
      </div>
      {/* Arrow */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-[#0D1B2A] rotate-45"
        style={{ [coords.below ? 'top' : 'bottom']: -6 }}
      />
    </div>,
    document.body
  ) : null

  return (
    <span className="relative inline-flex items-center gap-1">
      {children}
      <button
        ref={btnRef}
        onMouseEnter={show}
        onMouseLeave={() => setVisible(false)}
        onFocus={show}
        onBlur={() => setVisible(false)}
        className="text-[var(--text3)] hover:text-[var(--blue)] transition-colors flex-shrink-0"
        aria-label={`What is ${term}?`}
      >
        <HelpCircle size={iconSize} />
      </button>
      {tooltip}
    </span>
  )
}
