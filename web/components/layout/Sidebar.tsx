'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Newspaper,
  Target,
  BookOpen,
  TrendingUp,
  MessageCircle,
  Settings,
  ChevronRight,
} from 'lucide-react'
import MeridianArcWordmark from '@/components/brand/MeridianArcWordmark'

const navItems = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/sweep/latest', label: "This week's brief", icon: Newspaper, activeMatch: '/sweep' },
  { href: '/objectives', label: 'Your goals', icon: Target },
  { href: '/predictions', label: 'Predictions', icon: TrendingUp },
  { href: '/journal', label: 'Journal', icon: BookOpen },
  { href: '/ask', label: 'Ask Meridian Arc', icon: MessageCircle },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed top-0 left-0 w-60 h-screen bg-navy overflow-y-auto z-50 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/8">
        <MeridianArcWordmark size="sm" animate={true} />
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3">
        <div className="px-5 py-2 text-[8.5px] font-semibold tracking-widest uppercase text-white/28">
          Navigation
        </div>
        {navItems.map(({ href, label, icon: Icon, activeMatch }) => {
          const matchPath = activeMatch ?? href
          const active = pathname === matchPath || pathname.startsWith(matchPath + '/')
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
