'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut, User } from 'lucide-react'
import { useState } from 'react'
import SweepButton from '@/components/dashboard/SweepButton'

interface TopBarProps {
  title?: string
  subtitle?: string
  userEmail?: string
  lastSweepAt?: string | null
  nextSweepAt?: string | null
}

export default function TopBar({ title = 'Mission Control', subtitle, userEmail, lastSweepAt, nextSweepAt }: TopBarProps) {
  const router = useRouter()
  const supabase = createClient()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-14 border-b border-[var(--border)] bg-white flex items-center justify-between px-6 sticky top-0 z-40">
      <div>
        <h1 className="text-[15px] font-medium text-[var(--text)]">{title}</h1>
        {subtitle && <p className="text-[11px] text-[var(--text3)]">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        <SweepButton lastSweepAt={lastSweepAt} nextSweepAt={nextSweepAt} />

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-8 h-8 rounded-full bg-[var(--code-bg)] border border-[var(--border)] flex items-center justify-center hover:bg-[var(--gray-lt)] transition-colors"
          >
            <User size={14} className="text-[var(--text2)]" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-10 w-48 bg-white border border-[var(--border)] rounded-xl shadow-lg py-1 z-50">
              {userEmail && (
                <div className="px-3 py-2 text-[11px] text-[var(--text3)] border-b border-[var(--border)]">
                  {userEmail}
                </div>
              )}
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--text2)] hover:bg-[var(--gray-lt)] transition-colors"
              >
                <LogOut size={13} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
