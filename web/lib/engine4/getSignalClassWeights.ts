import type { SupabaseClient } from '@supabase/supabase-js'

// Returns active signal class weights for a user + objective domain.
// A weight is "active" only when outcomes_scored >= 3 — below that threshold
// the modifier is 1.0 (neutral) and not meaningful enough to inject.
// Returns null when no active weights exist for this domain.
export async function getSignalClassWeights(
  supabase: SupabaseClient,
  userId: string,
  objectiveDomain: string
): Promise<Record<string, number> | null> {
  const { data } = await supabase
    .from('signal_class_accuracy')
    .select('signal_class, weight_modifier, outcomes_scored')
    .eq('user_id', userId)
    .eq('objective_domain', objectiveDomain)
    .gte('outcomes_scored', 3) // only inject weights that have earned activation

  if (!data?.length) return null

  return Object.fromEntries(
    data.map(row => [row.signal_class as string, row.weight_modifier as number])
  )
}
