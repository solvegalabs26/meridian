import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runSweepForUser } from '@/lib/sweep/runSweepForUser'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = createClient()

  // 1. Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    objective_ids?: string[]
    manual_signals?: string
  }

  const result = await runSweepForUser(user.id, {
    objectiveIds: body.objective_ids,
    manualSignals: body.manual_signals,
  })

  if (!result.success) {
    const status = result.error === 'No active objectives found' ? 400 : 500
    return NextResponse.json({ error: result.error ?? 'Sweep failed' }, { status })
  }

  return NextResponse.json({
    sweep_id: result.sweepId,
    status: 'complete',
    signal_count: result.signalCount,
    objectives: result.objectives,
    summary: result.summary,
    top_priority_action: result.topPriorityAction,
    cross_dependencies: result.crossDependencies,
    tokens_used: result.tokensUsed,
    cost_usd: result.costUsd,
  })
}
