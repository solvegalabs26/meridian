import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { scoreOutcomeForPrediction } from '@/lib/engine4/scoreOutcomeForPrediction'

export const dynamic = 'force-dynamic'

// Path A: user marks an objective complete and records an outcome.
// After writing the objective_outcomes row, finds all active predictions
// linked to this objective and triggers Engine 4 closure scoring for each.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    outcome_type: 'HIT' | 'PARTIAL' | 'MISS'
    outcome_note?: string | null
    actual_completed_at?: string | null
    swept_at_close?: number | null
  }

  if (!['HIT', 'PARTIAL', 'MISS'].includes(body.outcome_type)) {
    return NextResponse.json({ error: 'Invalid outcome_type' }, { status: 400 })
  }

  // Write the objective_outcomes row
  const { data: outcomeRow, error: outcomeErr } = await supabase
    .from('objective_outcomes')
    .insert({
      user_id: user.id,
      objective_id: params.id,
      outcome_type: body.outcome_type,
      outcome_note: body.outcome_note ?? null,
      actual_completed_at: body.actual_completed_at ?? null,
      swept_at_close: body.swept_at_close ?? null,
    })
    .select('id')
    .single()

  if (outcomeErr || !outcomeRow) {
    return NextResponse.json({ error: outcomeErr?.message ?? 'Failed to write outcome' }, { status: 500 })
  }

  // Find all active predictions linked to this objective and score each
  const serviceClient = createServiceClient()

  const { data: activePredictions } = await serviceClient
    .from('predictions')
    .select('id, user_id')
    .eq('objective_id', params.id)
    .eq('status', 'active')

  if (activePredictions?.length) {
    const results = await Promise.allSettled(
      activePredictions.map(pred =>
        scoreOutcomeForPrediction(
          serviceClient,
          pred.id as string,
          outcomeRow.id,
          pred.user_id as string
        )
      )
    )

    const failures = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map(r => String(r.reason))

    if (failures.length) {
      console.error(`[complete:step11] ${failures.length} scoring failure(s) for objective ${params.id}:`, failures)
    }

    console.log(
      `[complete:step11] objective=${params.id} outcome=${body.outcome_type}` +
      ` predictions_scored=${results.filter(r => r.status === 'fulfilled').length}` +
      ` predictions_failed=${failures.length}`
    )
  }

  return NextResponse.json({ outcome_id: outcomeRow.id })
}
