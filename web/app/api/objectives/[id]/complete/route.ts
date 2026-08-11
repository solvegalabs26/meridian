import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Path A: user closes an objective with a recorded outcome.
// Writes objective_outcomes, updates objective status/closure_type,
// and triggers Engine 4 prediction scoring via Promise.allSettled.
//
// Written to be additive: if Engine 4 Step 11 (closure synthesis) is later
// merged into scoreOutcomeForPrediction, it activates automatically here.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    outcome_type: string
    outcome_note?: string | null
    actual_completed_at: string
    confidence_retrospective?: 'realistic' | 'overconfident' | 'underconfident' | null
    prediction_scores?: Array<{ prediction_id: string; outcome: string }>
  }

  if (!body.outcome_type || !body.actual_completed_at) {
    return NextResponse.json({ error: 'outcome_type and actual_completed_at are required' }, { status: 400 })
  }

  // Fetch current objective to capture swept_at_close (confidence at moment of close)
  const { data: objective } = await supabase
    .from('objectives')
    .select('confidence, user_id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!objective) return NextResponse.json({ error: 'Objective not found' }, { status: 404 })

  // 1. Write objective_outcomes row
  const { data: outcomeRow, error: outcomeErr } = await supabase
    .from('objective_outcomes')
    .insert({
      user_id: user.id,
      objective_id: params.id,
      outcome_type: body.outcome_type.toUpperCase(),
      outcome_note: body.outcome_note ?? null,
      actual_completed_at: body.actual_completed_at,
      swept_at_close: objective.confidence ?? null,
    })
    .select('id')
    .single()

  if (outcomeErr || !outcomeRow) {
    return NextResponse.json({ error: outcomeErr?.message ?? 'Failed to write outcome' }, { status: 500 })
  }

  // 2. Write confidence_retrospective to outcome row (non-blocking)
  if (body.confidence_retrospective) {
    await supabase
      .from('objective_outcomes')
      .update({ confidence_retrospective: body.confidence_retrospective })
      .eq('id', outcomeRow.id)
  }

  // 3. Update objectives: status + closure_type
  await supabase
    .from('objectives')
    .update({ status: 'closed', closure_type: 'closed', updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('user_id', user.id)

  // 4. Engine 4 prediction scoring (non-blocking — never block the outcome write)
  try {
    const serviceClient = createServiceClient()

    // Find all active predictions for this objective
    const { data: activePredictions } = await serviceClient
      .from('predictions')
      .select('id, user_id')
      .eq('objective_id', params.id)
      .eq('status', 'active')

    if (activePredictions?.length) {
      // Dynamic import so this route works standalone if Engine 4 isn't present
      let scoreOutcomeForPrediction: ((
        supabase: typeof serviceClient,
        predictionId: string,
        outcomeId: string,
        userId: string
      ) => Promise<void>) | null = null

      try {
        const mod = await import('@/lib/engine4/scoreOutcomeForPrediction')
        scoreOutcomeForPrediction = mod.scoreOutcomeForPrediction
      } catch {
        // Engine 4 not available — skip automatic scoring
      }

      if (scoreOutcomeForPrediction) {
        await Promise.allSettled(
          activePredictions.map(pred =>
            scoreOutcomeForPrediction!(
              serviceClient,
              pred.id as string,
              outcomeRow.id,
              pred.user_id as string
            )
          )
        )
      }
    }
  } catch (err) {
    console.error(`[complete] Engine 4 scoring failed for objective ${params.id}:`, err)
  }

  return NextResponse.json({ outcome_id: outcomeRow.id })
}
