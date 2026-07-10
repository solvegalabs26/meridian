'use client'

import { useState, useRef, useEffect } from 'react'
import { HelpCircle, RotateCcw, BookOpen, CheckSquare, Settings } from 'lucide-react'

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
          className="absolute right-0 top-10 w-72 rounded-xl shadow-lg py-1 z-50"
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

          {/* Tips — static info rows, no action */}
          <div className="mx-2 my-1.5" style={{ borderTop: '1px solid var(--border)' }} />
          <div className="px-3 pb-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text3)' }}>Tips</p>
            <div className="flex gap-2.5 mb-3">
              <CheckSquare size={13} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--gold)' }} />
              <div>
                <p className="text-[12px] font-medium leading-snug mb-0.5" style={{ color: 'var(--text)' }}>Log what you did</p>
                <p className="text-[11px] leading-snug" style={{ color: 'var(--text3)' }}>In any goal → <strong>What to do</strong>, scroll down and tap &ldquo;+ I did something.&rdquo; Your confidence score updates instantly.</p>
              </div>
            </div>
            <div className="flex gap-2.5">
              <Settings size={13} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--blue)' }} />
              <div>
                <p className="text-[12px] font-medium leading-snug mb-0.5" style={{ color: 'var(--text)' }}>Edit a goal</p>
                <p className="text-[11px] leading-snug" style={{ color: 'var(--text3)' }}>Tap the <strong>⚙ gear icon</strong> on any goal to update title, date, or price fields.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
