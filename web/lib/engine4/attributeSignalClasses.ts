import type { SupabaseClient } from '@supabase/supabase-js'
import { computeWeightModifier } from './scoreOutcome'

// For a given objective and date window, find which signal classes were
// present and credit each with the accuracy score from the scored outcome.
// Called after prediction_scores row is written.
export async function attributeSignalClasses(
  supabase: SupabaseClient,
  userId: string,
  objectiveId: string,
  objectiveDomain: string,
  predictionCreatedAt: string,
  outcomeDate: string,
  accuracyScore: number
): Promise<void> {
  // 1. Query signals written for this objective during the prediction window
  const { data: signals } = await supabase
    .from('signals')
    .select('signal_class')
    .contains('objective_ids', [objectiveId])
    .gte('created_at', predictionCreatedAt)
    .lte('created_at', outcomeDate)

  if (!signals?.length) return

  // 2. Unique signal classes present in this window
  const classes = Array.from(
    new Set(signals.map(s => s.signal_class as string | null).filter((c): c is string => c !== null))
  )

  // 3. Upsert accuracy contribution for each class
  for (const signalClass of classes) {
    const { data: existing } = await supabase
      .from('signal_class_accuracy')
      .select('id, outcomes_scored, accuracy_sum')
      .eq('user_id', userId)
      .eq('objective_domain', objectiveDomain)
      .eq('signal_class', signalClass)
      .single()

    if (existing) {
      const newScored = existing.outcomes_scored + 1
      const newSum = (existing.accuracy_sum as number) + accuracyScore
      const newAvg = newSum / newScored
      // Weight modifier only activates at 3+ outcomes; stays neutral until then
      const newWeight = newScored >= 3 ? computeWeightModifier(newAvg) : 1.0

      await supabase
        .from('signal_class_accuracy')
        .update({
          outcomes_scored: newScored,
          accuracy_sum: newSum,
          weight_modifier: newWeight,
          last_updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('signal_class_accuracy')
        .insert({
          user_id: userId,
          objective_domain: objectiveDomain,
          signal_class: signalClass,
          outcomes_scored: 1,
          accuracy_sum: accuracyScore,
          weight_modifier: 1.0, // pending until 3+ outcomes
        })
    }
  }
}
