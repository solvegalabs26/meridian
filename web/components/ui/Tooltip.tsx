'use client'

import { useState, useRef, useEffect } from 'react'
import { HelpCircle } from 'lucide-react'

interface TooltipProps {
  term: string
  definition: string
  children?: React.ReactNode
  iconSize?: number
}

export default function Tooltip({ term, definition, children, iconSize = 13 }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<'top' | 'bottom'>('top')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (visible && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setPosition(rect.top < 180 ? 'bottom' : 'top')
    }
  }, [visible])

  return (
    <span className="relative inline-flex items-center gap-1" ref={ref}>
      {children}
      <button
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="text-[var(--text3)] hover:text-[var(--blue)] transition-colors flex-shrink-0"
        aria-label={`What is ${term}?`}
      >
        <HelpCircle size={iconSize} />
      </button>

      {visible && (
        <div className={`absolute z-50 left-1/2 -translate-x-1/2 w-72 ${
          position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
        }`}>
          <div className="bg-[var(--night)] text-white rounded-xl shadow-xl p-4">
            <p className="text-[11px] font-semibold text-[var(--gold)] uppercase tracking-wider mb-1.5">{term}</p>
            <p className="text-[12.5px] leading-relaxed text-white/80">{definition}</p>
          </div>
          {/* Arrow */}
          <div className={`absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-[var(--night)] rotate-45 ${
            position === 'top' ? 'top-full -mt-1.5' : 'bottom-full -mb-1.5'
          }`} />
        </div>
      )}
    </span>
  )
}
