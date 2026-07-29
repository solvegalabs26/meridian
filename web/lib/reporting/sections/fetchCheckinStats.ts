import type { SupabaseClient } from '@supabase/supabase-js'
import type { CheckinStatsData } from '../types'

export async function fetchCheckinStats(
  service: SupabaseClient,
  orgSource: string,   // single org code — always explicit, never a wildcard
  startDate: Date,
  endDate: Date
): Promise<CheckinStatsData> {
  // org_source is the sole cohort partition key.
  // account_type is intentionally NOT in this query — all veteran orgs share
  // account_type='veteran' and filtering by it would cross cohort boundaries.
  const { data: cohortUsers } = await service
    .from('profiles')
    .select('id')
    .eq('org_source', orgSource)
    .eq('checkin_enabled', true)

  if (!cohortUsers || cohortUsers.length === 0) {
    return { totalEligible: 0, totalSubmitted: 0, overallCompletionRate: 0, weeklyRows: [] }
  }

  const userIds = cohortUsers.map(u => u.id as string)
  const totalEligible = userIds.length

  const { data: checkins } = await service
    .from('user_reflections')
    .select('user_id, week_of, briefing_rating')
    .in('user_id', userIds)
    .gte('week_of', startDate.toISOString().slice(0, 10))
    .lte('week_of', endDate.toISOString().slice(0, 10))
    .order('week_of', { ascending: true })

  const byWeek: Record<string, { weekOf: string; submitted: number; ratings: number[] }> = {}

  for (const row of checkins ?? []) {
    const key = row.week_of as string
    if (!byWeek[key]) byWeek[key] = { weekOf: key, submitted: 0, ratings: [] }
    byWeek[key].submitted++
    if (row.briefing_rating) byWeek[key].ratings.push(row.briefing_rating as number)
  }

  const weeklyRows = Object.values(byWeek).map(w => ({
    weekOf: w.weekOf,
    submitted: w.submitted,
    eligible: totalEligible,
    completionPct: Math.round((w.submitted / totalEligible) * 100),
    avgRating: w.ratings.length > 0
      ? Math.round((w.ratings.reduce((a, b) => a + b, 0) / w.ratings.length) * 10) / 10
      : null,
  }))

  const totalSubmitted = checkins?.length ?? 0
  const totalPossible = totalEligible * Math.max(weeklyRows.length, 1)
  const overallCompletionRate = totalPossible > 0
    ? Math.round((totalSubmitted / totalPossible) * 100)
    : 0

  return { totalEligible, totalSubmitted, overallCompletionRate, weeklyRows }
}
