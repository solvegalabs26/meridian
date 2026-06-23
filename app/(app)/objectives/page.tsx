import Link from 'next/link'
import { Plus } from 'lucide-react'

export default function ObjectivesPage() {
  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-medium text-[var(--text)]">Objectives</h1>
          <p className="text-[14px] text-[var(--text3)] mt-1">Your active life and career objectives</p>
        </div>
        <Link
          href="/objectives/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-navy text-white text-[13px] font-medium hover:bg-[var(--night)] transition-colors"
        >
          <Plus size={14} />
          Add objective
        </Link>
      </div>
      <div className="bg-white rounded-2xl border border-[var(--border)] p-8 text-center text-[var(--text3)] text-[14px]">
        Objectives are built in Phase 2. Database and types are ready.
      </div>
    </div>
  )
}
