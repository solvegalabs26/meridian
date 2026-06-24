'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import ObjectiveCard from '@/components/objectives/ObjectiveCard'
import { Objective } from '@/lib/utils/types'

type Tab = 'active' | 'archived' | 'all'

interface Props {
  objectives: Objective[]
  error: string | null
}

export default function ObjectivesClient({ objectives, error }: Props) {
  const [tab, setTab] = useState<Tab>('active')

  const active   = objectives.filter(o => o.status === 'active')
  const archived = objectives.filter(o => o.status === 'closed' || o.status === 'paused')
  const achieved = objectives.filter(o => o.status === 'achieved')

  const displayed = tab === 'active'
    ? active
    : tab === 'archived'
    ? [...archived, ...achieved]
    : objectives

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'active',   label: 'Active',   count: active.length },
    { id: 'archived', label: 'Archived', count: archived.length + achieved.length },
    { id: 'all',      label: 'All',      count: objectives.length },
  ]

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[22px] font-medium text-[var(--text)]">Objectives</h1>
        <Link
          href="/objectives/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-navy text-white text-[13px] font-medium hover:bg-[var(--night)] transition-colors"
        >
          <Plus size={14} />
          Add objective
        </Link>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-5 bg-white border border-[var(--border)] rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
              tab === t.id
                ? 'bg-navy text-white shadow-sm'
                : 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--gray-lt)]'
            }`}
          >
            {t.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              tab === t.id ? 'bg-white/20 text-white' : 'bg-[var(--gray-lt)] text-[var(--text3)]'
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-[var(--red-lt)] text-[var(--red)] text-[13px]">
          Error loading objectives: {error}
        </div>
      )}

      {displayed.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[var(--border)] p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-[var(--gray-lt)] flex items-center justify-center mx-auto mb-4">
            <Plus size={24} className="text-[var(--text3)]" />
          </div>
          {tab === 'active' ? (
            <>
              <h2 className="text-[16px] font-medium text-[var(--text)] mb-2">No active objectives</h2>
              <p className="text-[13px] text-[var(--text2)] mb-5">Add your first objective to start tracking your progress.</p>
              <Link
                href="/objectives/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-navy text-white text-[13px] font-medium hover:bg-[var(--night)] transition-colors"
              >
                <Plus size={14} />
                Add first objective
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-[16px] font-medium text-[var(--text)] mb-2">
                {tab === 'archived' ? 'No archived objectives' : 'No objectives yet'}
              </h2>
              <p className="text-[13px] text-[var(--text2)]">
                {tab === 'archived' ? 'Archived objectives will appear here.' : 'Add your first objective to get started.'}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayed.map(obj => (
            <ObjectiveCard key={obj.id} obj={obj} />
          ))}
        </div>
      )}
    </div>
  )
}
