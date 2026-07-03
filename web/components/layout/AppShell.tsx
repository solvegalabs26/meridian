'use client'

import { useState, useEffect, useRef } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import TutorialModal from '@/components/tutorial/TutorialModal'
import KeyTermsModal from '@/components/tutorial/KeyTermsModal'

interface AppShellProps {
  children: React.ReactNode
  userEmail?: string
  lastSweepAt?: string | null
  nextSweepAt?: string | null
  tutorialViewsCount?: number
}

export default function AppShell({
  children,
  userEmail,
  lastSweepAt,
  nextSweepAt,
  tutorialViewsCount = 0,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [keyTermsOpen, setKeyTermsOpen] = useState(false)
  const incrementFired = useRef(false)

  useEffect(() => {
    // Auto-open on first two logins. Guard with ref to survive React strict-mode
    // double-invoke in development (the second invoke sees incrementFired = true).
    if (tutorialViewsCount < 2) {
      setTutorialOpen(true)

      if (!incrementFired.current) {
        incrementFired.current = true
        fetch('/api/tutorial/seen', { method: 'POST' }).catch(() => {
          // Non-fatal — tutorial still works; user may see it one extra time
        })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally run once on mount

  function openTutorial() {
    setTutorialOpen(true)
    // Manual open from Help menu — never increments counter
  }

  function openKeyTerms() {
    setKeyTermsOpen(true)
  }

  return (
    <div className="min-h-screen bg-[var(--gray-lt)]">
      {/* Mobile backdrop — tap to close */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="md:ml-60">
        <TopBar
          userEmail={userEmail}
          lastSweepAt={lastSweepAt}
          nextSweepAt={nextSweepAt}
          onMenuClick={() => setSidebarOpen(true)}
          onOpenTutorial={openTutorial}
          onOpenKeyTerms={openKeyTerms}
        />
        <main className="p-4 md:p-6">
          {children}
        </main>
      </div>

      <TutorialModal
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        startPage={1}
        onOpenKeyTerms={() => setKeyTermsOpen(true)}
      />

      <KeyTermsModal
        open={keyTermsOpen}
        onClose={() => setKeyTermsOpen(false)}
      />
    </div>
  )
}
