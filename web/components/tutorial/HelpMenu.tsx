'use client'

import { useState, useRef, useEffect } from 'react'
import { HelpCircle, RotateCcw, BookOpen } from 'lucide-react'

interface HelpMenuProps {
  onOpenTutorial: () => void
  onOpenKeyTerms: () => void
}

export default function HelpMenu({ onOpenTutorial, onOpenKeyTerms }: HelpMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function handleTutorial() {
    setOpen(false)
    onOpenTutorial()
  }

  function handleKeyTerms() {
    setOpen(false)
    onOpenKeyTerms()
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors hover:bg-[var(--gray-lt)]"
        style={{ color: 'var(--text2)' }}
        aria-label="Help and Tour"
        aria-expanded={open}
      >
        <HelpCircle size={15} />
        <span className="hidden sm:inline">Help &amp; Tour</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 w-52 rounded-xl shadow-lg py-1 z-50"
          style={{ backgroundColor: 'var(--white)', border: '1px solid var(--border)' }}
          role="menu"
        >
          <button
            onClick={handleTutorial}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-left transition-colors hover:bg-[var(--gray-lt)]"
            style={{ color: 'var(--text)' }}
            role="menuitem"
          >
            <RotateCcw size={13} className="flex-shrink-0 text-[var(--text3)]" />
            Restart the tour
          </button>
          <button
            onClick={handleKeyTerms}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-left transition-colors hover:bg-[var(--gray-lt)]"
            style={{ color: 'var(--text)' }}
            role="menuitem"
          >
            <BookOpen size={13} className="flex-shrink-0 text-[var(--text3)]" />
            Key Terms &amp; Definitions
          </button>
        </div>
      )}
    </div>
  )
}
