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
        <h1 className="text-[22px] font-medium text-[var(--text)]">Goals</h1>
        <Link
          href="/objectives/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-navy text-white text-[13px] font-medium hover:bg-[var(--night)] transition-colors"
        >
          <Plus size={14} />
          Add goal
        </Link>
      </div>

      {/* Tab links */}
      <div className="flex items-center gap-6 mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`group flex items-baseline gap-1.5 text-[11px] font-semibold tracking-widest uppercase transition-colors ${
              tab === t.id
                ? 'text-[var(--blue)]'
                : 'text-[var(--text3)] hover:text-[var(--blue)]'
            }`}
          >
            <span className={tab === t.id ? '' : 'group-hover:animate-pulse'}>
              {t.label}
            </span>
            <span className={`text-[10px] font-normal tracking-normal normal-case ${
              tab === t.id ? 'text-[var(--blue)]' : 'text-[var(--text3)]'
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-[var(--red-lt)] text-[var(--red)] text-[13px]">
          Error loading goals: {error}
        </div>
      )}

      {displayed.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[var(--border)] p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-[var(--gray-lt)] flex items-center justify-center mx-auto mb-4">
            <Plus size={24} className="text-[var(--text3)]" />
          </div>
          {tab === 'active' ? (
            <>
              <h2 className="text-[16px] font-medium text-[var(--text)] mb-2">No active goals</h2>
              <p className="text-[13px] text-[var(--text2)] mb-5">Add your first goal to start tracking your progress.</p>
              <Link
                href="/objectives/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-navy text-white text-[13px] font-medium hover:bg-[var(--night)] transition-colors"
              >
                <Plus size={14} />
                Add first goal
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-[16px] font-medium text-[var(--text)] mb-2">
                {tab === 'archived' ? 'No archived goals' : 'No goals yet'}
              </h2>
              <p className="text-[13px] text-[var(--text2)]">
                {tab === 'archived' ? 'Archived goals will appear here.' : 'Add your first goal to get started.'}
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
