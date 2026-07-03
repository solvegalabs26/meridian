'use client'

import { useState } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

interface AppShellProps {
  children: React.ReactNode
  userEmail?: string
  lastSweepAt?: string | null
  nextSweepAt?: string | null
}

export default function AppShell({ children, userEmail, lastSweepAt, nextSweepAt }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
        />
        <main className="p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
