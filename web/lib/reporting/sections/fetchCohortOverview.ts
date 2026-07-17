import type { ReportingClient, CohortOverviewData } from '../types'

export async function fetchCohortOverview(
  service: ReportingClient,
  userIds: string[],
  periodStart: Date
): Promise<CohortOverviewData> {
  if (userIds.length === 0) {
    return { totalEnrolled: 0, activeThisWeek: 0, sweepCompletionRate: 0, avgObjectivesPerUser: 0 }
  }

  // Active = had a sweep completed since periodStart
  const [
    { data: sweepsThisPeriod },
    { data: objectives },
  ] = await Promise.all([
    service
      .from('sweeps')
      .select('user_id, status')
      .in('user_id', userIds)
      .gte('created_at', periodStart.toISOString()),
    service
      .from('objectives')
      .select('user_id')
      .in('user_id', userIds)
      .eq('status', 'active'),
  ])

  const usersWithSweep = new Set((sweepsThisPeriod ?? []).map(s => s.user_id as string))
  const completedSweepUsers = new Set(
    (sweepsThisPeriod ?? [])
      .filter(s => s.status === 'complete')
      .map(s => s.user_id as string)
  )

  const totalObjs = (objectives ?? []).length
  const avgObjectivesPerUser = userIds.length > 0 ? Math.round((totalObjs / userIds.length) * 10) / 10 : 0
  const sweepCompletionRate = usersWithSweep.size > 0
    ? Math.round((completedSweepUsers.size / userIds.length) * 100)
    : 0

  return {
    totalEnrolled: userIds.length,
    activeThisWeek: usersWithSweep.size,
    sweepCompletionRate,
    avgObjectivesPerUser,
  }
}
