'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export function RecentlyViewedAccounts() {
  const [accounts, setAccounts] = useState<string[]>([])

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('meridian_rv_accounts') || '[]')
      if (Array.isArray(stored)) setAccounts(stored.slice(0, 10))
    } catch {}
  }, [])

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-3 py-2.5 border-b border-gray-800">
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
          Recently Viewed
        </div>
      </div>
      <div className="p-3">
        {accounts.length === 0 ? (
          <p className="text-[11px] text-gray-700 leading-relaxed">
            Account links in objective write-ups will appear here.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {accounts.map(ref => (
              <Link
                key={ref}
                href={`/enterprise/report?highlight=${encodeURIComponent(ref)}`}
                className="flex items-center gap-1.5 text-[11px] font-mono text-yellow-500 hover:text-yellow-300 hover:underline transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-600 flex-shrink-0" />
                {ref}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
