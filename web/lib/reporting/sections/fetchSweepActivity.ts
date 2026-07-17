import type { ReportingClient, SweepActivityData } from '../types'

export async function fetchSweepActivity(
  service: ReportingClient,
  userIds: string[],
  periodStart: Date
): Promise<SweepActivityData> {
  if (userIds.length === 0) {
    return { sweepsThisPeriod: 0, pctUsersWithSweep: 0, missedSweepCount: 0 }
  }

  const { data: sweeps } = await service
    .from('sweeps')
    .select('user_id, status')
    .in('user_id', userIds)
    .eq('status', 'complete')
    .gte('created_at', periodStart.toISOString())

  const usersWithSweep = new Set((sweeps ?? []).map(s => s.user_id as string))
  const missedSweepCount = userIds.filter(id => !usersWithSweep.has(id)).length

  return {
    sweepsThisPeriod: (sweeps ?? []).length,
    pctUsersWithSweep: Math.round((usersWithSweep.size / userIds.length) * 100),
    missedSweepCount,
  }
}
