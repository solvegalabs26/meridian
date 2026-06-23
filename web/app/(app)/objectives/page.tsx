import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import ObjectiveCard from '@/components/objectives/ObjectiveCard'
import { Objective } from '@/lib/utils/types'

export default async function ObjectivesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: objectives, error } = await supabase
    .from('objectives')
    .select('*')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })

  const active = objectives?.filter(o => o.status === 'active') ?? []
  const other  = objectives?.filter(o => o.status !== 'active') ?? []

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-medium text-[var(--text)]">Objectives</h1>
          <p className="text-[13px] text-[var(--text3)] mt-0.5">
            {active.length} active · {other.length} other
          </p>
        </div>
        <Link
          href="/objectives/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-navy text-white text-[13px] font-medium hover:bg-[var(--night)] transition-colors"
        >
          <Plus size={14} />
          Add objective
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-[var(--red-lt)] text-[var(--red)] text-[13px]">
          Error loading objectives: {error.message}
        </div>
      )}

      {(!objectives || objectives.length === 0) && (
        <div className="bg-white rounded-2xl border border-[var(--border)] p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-[var(--gray-lt)] flex items-center justify-center mx-auto mb-4">
            <Plus size={24} className="text-[var(--text3)]" />
          </div>
          <h2 className="text-[16px] font-medium text-[var(--text)] mb-2">No objectives yet</h2>
          <p className="text-[13px] text-[var(--text2)] mb-5">Add your first objective to start tracking your progress.</p>
          <Link
            href="/objectives/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-navy text-white text-[13px] font-medium hover:bg-[var(--night)] transition-colors"
          >
            <Plus size={14} />
            Add first objective
          </Link>
        </div>
      )}

      {active.length > 0 && (
        <div className="mb-6">
          <h2 className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wider mb-3">Active</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {active.map(obj => <ObjectiveCard key={obj.id} obj={obj as Objective} />)}
          </div>
        </div>
      )}

      {other.length > 0 && (
        <div>
          <h2 className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wider mb-3">Other</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {other.map(obj => <ObjectiveCard key={obj.id} obj={obj as Objective} />)}
          </div>
        </div>
      )}
    </div>
  )
}
