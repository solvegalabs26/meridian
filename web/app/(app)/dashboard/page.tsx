import { createClient } from '@/lib/supabase/server'
import HeadlineCard from '@/components/dashboard/HeadlineCard'
import GoalCard from '@/components/dashboard/GoalCard'
import DoNextCard from '@/components/dashboard/DoNextCard'
import CrossDepBanner, { type CrossDep } from '@/components/dashboard/CrossDepBanner'
import SweepStatusStrip from '@/components/dashboard/SweepStatusStrip'
import { getConfidenceStatus } from '@/lib/utils/confidenceStatus'

const STATUS_RANK = { risk: 0, watch: 1, on_track: 2 }

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, { data: objectives }, { data: lastSweep }, { data: unreadSignals }] = await Promise.all([
    supabase.from('profiles').select('full_name, sweep_count, tier').eq('id', user!.id).single(),
    supabase.from('objectives').select('id, obj_id, title, confidence, confidence_prev, target_date, updated_at, status').eq('user_id', user!.id).eq('status', 'active').order('sort_order'),
    supabase.from('sweeps').select('*').eq('user_id', user!.id).eq('status', 'complete').order('completed_at', { ascending: false }).limit(1).single(),
    supabase.from('signals').select('objective_ids').eq('user_id', user!.id).eq('is_read', false),
  ])

  const hasSweep = !!lastSweep
  const sweepData = lastSweep?.raw_response as {
    sweep_summary?: string
    top_priority_action?: string
    objectives?: Array<{
      obj_id: string
      opportunities?: string[]
      risks?: string[]
      changed_since_last_sweep?: string
      actions?: string[]
    }>
    cross_objective_dependencies?: Array<{
      from_obj: string
      to_obj: string
      description: string
      urgency: string
    }>
  } | null

  const objectiveList = objectives ?? []

  // Unread signal count per objective
  const signalCounts: Record<string, number> = {}
  for (const sig of unreadSignals ?? []) {
    for (const objId of sig.objective_ids ?? []) {
      signalCounts[objId] = (signalCounts[objId] ?? 0) + 1
    }
  }

  // Cross-dependencies, resolved to plain objective names
  const crossDeps: CrossDep[] = (sweepData?.cross_objective_dependencies ?? []).map(dep => {
    const fromObj = objectiveList.find(o => o.obj_id === dep.from_obj)
    const toObj = objectiveList.find(o => o.obj_id === dep.to_obj)
    return {
      id: `${dep.from_obj}-${dep.to_obj}`,
      fromObjective: fromObj?.title ?? dep.from_obj,
      toObjective: toObj?.title ?? dep.to_obj,
      description: dep.description,
    }
  })

  const topAction = sweepData?.top_priority_action ?? null
  const moreActions = (sweepData?.objectives?.flatMap(o => o.actions ?? []) ?? [])
    .filter(a => a !== topAction)
    .slice(0, 5)

  const sortedObjectives = [...objectiveList].sort(
    (a, b) => STATUS_RANK[getConfidenceStatus(a.confidence)] - STATUS_RANK[getConfidenceStatus(b.confidence)]
  )

  return (
    <div className="-m-6 p-6 min-h-[calc(100vh-3.5rem)]" style={{ backgroundColor: 'var(--navy)' }}>
    <div className="max-w-2xl space-y-4">
      <SweepStatusStrip lastSweepAt={lastSweep?.completed_at ?? null} />

      <CrossDepBanner crossDeps={crossDeps} />

      <HeadlineCard objectives={objectiveList} hasSweep={hasSweep} />

      <div>
        <p className="text-[9px] uppercase tracking-widest font-semibold mb-2" style={{ color: 'var(--blue-mid)' }}>
          Your goals
        </p>
        {sortedObjectives.length === 0 ? (
          <p className="text-[13px]" style={{ color: 'var(--ov-text-dim)' }}>No goals yet.</p>
        ) : (
          <div className="space-y-3">
            {sortedObjectives.map(obj => (
              <GoalCard
                key={obj.id}
                objective={obj}
                newSignalCount={signalCounts[obj.id] ?? 0}
              />
            ))}
          </div>
        )}
      </div>

      <DoNextCard topAction={topAction} moreActions={moreActions} hasSweep={hasSweep} />

      <p className="text-[10px] text-center pt-2" style={{ color: 'var(--ov-text-dim)' }}>
        Meridian Arc surfaces AI-generated insights — always use your own judgment for major decisions.
      </p>
    </div>
    </div>
  )
}
