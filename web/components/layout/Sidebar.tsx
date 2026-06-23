'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Target,
  Radio,
  BookOpen,
  TrendingUp,
  Filter,
  Settings,
  ChevronRight,
} from 'lucide-react'
import MeridianBeacon from '@/components/brand/MeridianBeacon'

const navItems = [
  { href: '/dashboard', label: 'Mission Control', icon: LayoutDashboard },
  { href: '/objectives', label: 'Objectives', icon: Target },
  { href: '/signals', label: 'Signal Feed', icon: Radio },
  { href: '/journal', label: 'Journal', icon: BookOpen },
  { href: '/predictions', label: 'Predictions', icon: TrendingUp },
  { href: '/rules', label: 'Rules Filter', icon: Filter },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed top-0 left-0 w-60 h-screen bg-navy overflow-y-auto z-50 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/8">
        <div className="flex items-center gap-2.5">
          <MeridianBeacon size={28} variant="gold" animate={true} />
          <div>
            <div className="text-[13px] font-medium text-white tracking-wide italic">meridian</div>
            <div className="text-[9px] text-blue-mid tracking-widest uppercase mt-0.5">Solvega Labs</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3">
        <div className="px-5 py-2 text-[8.5px] font-semibold tracking-widest uppercase text-white/28">
          Navigation
        </div>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-5 py-2.5 text-[12.5px] transition-all border-l-2 ${
                active
                  ? 'text-white border-l-gold bg-white/4'
                  : 'text-white/55 border-l-transparent hover:text-white hover:border-l-blue-brand'
              }`}
            >
              <Icon size={15} />
              {label}
            </Link>
          )
        })}

        <div className="px-5 py-2 mt-2 text-[8.5px] font-semibold tracking-widest uppercase text-white/28">
          Coming Soon
        </div>
        <div className="flex items-center gap-3 px-5 py-2.5 text-[12.5px] text-white/25 cursor-not-allowed border-l-2 border-l-transparent">
          <ChevronRight size={15} />
          Scenarios
        </div>
      </nav>

      {/* Settings */}
      <div className="border-t border-white/8 p-3">
        <Link
          href="/settings"
          className={`flex items-center gap-3 px-3 py-2.5 text-[12.5px] rounded-lg transition-all ${
            pathname === '/settings'
              ? 'text-white bg-white/8'
              : 'text-white/55 hover:text-white hover:bg-white/4'
          }`}
        >
          <Settings size={15} />
          Settings
        </Link>
      </div>
    </aside>
  )
}
