import { type NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { runPortfolioSweep } from '@/lib/enterprise/sweep-fork1'
import { runObjectiveSweep } from '@/lib/enterprise/sweep-fork2'
import type { ObjectiveSweepResult } from '@/lib/enterprise/sweep-fork2'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  const startMs = Date.now()

  // Auth: service-role Bearer only
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { institution_id?: string; objective_ids?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { institution_id: institutionId, objective_ids: requestedObjectiveIds } = body
  if (!institutionId) {
    return NextResponse.json({ error: 'institution_id is required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Verify institution exists
  const { data: institution, error: instErr } = await supabase
    .from('enterprise_institutions')
    .select('id')
    .eq('id', institutionId)
    .single()

  if (instErr || !institution) {
    return NextResponse.json({ error: `Institution not found: ${institutionId}` }, { status: 404 })
  }

  // ── Fork 1: Portfolio sweep ──
  let fork1Result
  try {
    fork1Result = await runPortfolioSweep(institutionId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[FF-035-B] Fork 1 failed:', msg)
    return NextResponse.json({ error: `Portfolio sweep failed: ${msg}` }, { status: 500 })
  }

  // ── Fork 2: Objective sweeps ──
  // Load objectives in focus state (or the specifically requested ones)
  let objectivesQuery = supabase
    .from('enterprise_objectives')
    .select('id, obj_id')
    .eq('institution_id', institutionId)
    .eq('status', 'active')

  if (requestedObjectiveIds && requestedObjectiveIds.length > 0) {
    objectivesQuery = objectivesQuery.in('id', requestedObjectiveIds)
  } else {
    objectivesQuery = objectivesQuery.eq('objective_state', 'focus')
  }

  const { data: objectivesData } = await objectivesQuery.order('objective_order')
  const objectives = objectivesData ?? []

  // Run all objective sweeps concurrently with Promise.allSettled
  const settled = await Promise.allSettled(
    objectives.map(obj =>
      runObjectiveSweep(institutionId, obj.id as string, fork1Result.metricsId)
    )
  )

  const fork2Results: ObjectiveSweepResult[] = []
  const failedObjectiveIds: string[] = []

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i]
    if (result.status === 'fulfilled') {
      fork2Results.push(result.value)
    } else {
      const obj = objectives[i]
      const msg = result.reason instanceof Error ? result.reason.message : String(result.reason)
      console.error(`[FF-035-B] Fork 2 failed for ${obj.obj_id} (${obj.id}):`, msg)
      failedObjectiveIds.push(obj.id as string)
    }
  }

  return NextResponse.json({
    institution_id: institutionId,
    fork1: fork1Result,
    fork2: fork2Results,
    total_duration_ms: Date.now() - startMs,
    objectives_swept: fork2Results.length,
    objectives_failed: failedObjectiveIds.length,
    failed_objective_ids: failedObjectiveIds,
  })
}
