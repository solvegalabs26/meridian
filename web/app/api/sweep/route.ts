import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { runSweepForUser } from '@/lib/sweep/runSweepForUser'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // Vercel Pro limit — needed for 5+ objective sweeps

const RATE_LIMITED_TYPES = new Set(['alpha_personal', 'alpha_business', 'beta', 'personal'])
const RATE_LIMIT_MS = 23 * 60 * 60 * 1000

export async function POST(request: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    objective_ids?: string[]
    manual_signals?: string
  }

  // Fetch profile for rate limit check
  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('account_type, last_sweep_at')
    .eq('id', user.id)
    .single()

  // Rate limit: 23h minimum gap for all current account types
  if (RATE_LIMITED_TYPES.has(profile?.account_type ?? 'personal')) {
    if (profile?.last_sweep_at) {
      const nextSweepAt = new Date(new Date(profile.last_sweep_at).getTime() + RATE_LIMIT_MS)
      if (nextSweepAt > new Date()) {
        return NextResponse.json(
          { error: 'rate_limited', next_sweep_at: nextSweepAt.toISOString() },
          { status: 429 }
        )
      }
    }
  }

  const result = await runSweepForUser(user.id, {
    objectiveIds: body.objective_ids,
    manualSignals: body.manual_signals,
  })

  if (!result.success) {
    const status = result.error === 'No active objectives found' ? 400 : 500
    return NextResponse.json({ error: result.error ?? 'Sweep failed' }, { status })
  }

  // Record sweep time on success
  await service
    .from('profiles')
    .update({ last_sweep_at: new Date().toISOString() })
    .eq('id', user.id)

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
