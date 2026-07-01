'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Newspaper, Target, MessageCircle } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/sweep/latest', label: 'Brief', icon: Newspaper, activeMatch: '/sweep' },
  { href: '/objectives', label: 'Goals', icon: Target },
  { href: '/ask', label: 'Ask', icon: MessageCircle },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch"
      style={{ backgroundColor: 'var(--navy)', borderTop: '1px solid var(--ov-border-md)' }}
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon, activeMatch }) => {
        const matchPath = activeMatch ?? href
        const active = pathname === matchPath || pathname.startsWith(matchPath + '/')
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px]"
            style={{
              color: active ? '#fff' : 'var(--ov-text-dim)',
              borderTop: active ? '2px solid var(--gold)' : '2px solid transparent',
            }}
          >
            <Icon size={18} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
