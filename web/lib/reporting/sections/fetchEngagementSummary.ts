import type { ReportingClient, EngagementSummaryData } from '../types'

export async function fetchEngagementSummary(
  service: ReportingClient,
  userIds: string[],
  periodStart: Date
): Promise<EngagementSummaryData> {
  if (userIds.length === 0) {
    return { askQueriesTotal: 0, actionsLoggedTotal: 0, lastActiveDistribution: [] }
  }

  const [
    { count: askCount },
    { count: actionsCount },
    { data: profiles },
  ] = await Promise.all([
    service
      .from('ask_queries')
      .select('*', { count: 'exact', head: true })
      .in('user_id', userIds)
      .gte('created_at', periodStart.toISOString()),
    service
      .from('objective_actions')
      .select('*', { count: 'exact', head: true })
      .in('user_id', userIds)
      .gte('created_at', periodStart.toISOString()),
    service
      .from('profiles')
      .select('last_sweep_at')
      .in('id', userIds),
  ])

  // Last-active buckets based on last_sweep_at
  const now = Date.now()
  const buckets: Record<string, number> = {
    'This week': 0,
    'Last 30 days': 0,
    '30–90 days': 0,
    '90+ days': 0,
    'Never': 0,
  }

  for (const p of profiles ?? []) {
    if (!p.last_sweep_at) { buckets['Never']++; continue }
    const daysAgo = (now - new Date(p.last_sweep_at as string).getTime()) / 86400000
    if (daysAgo <= 7) buckets['This week']++
    else if (daysAgo <= 30) buckets['Last 30 days']++
    else if (daysAgo <= 90) buckets['30–90 days']++
    else buckets['90+ days']++
  }

  return {
    askQueriesTotal: askCount ?? 0,
    actionsLoggedTotal: actionsCount ?? 0,
    lastActiveDistribution: Object.entries(buckets)
      .filter(([, count]) => count > 0)
      .map(([bucket, count]) => ({ bucket, count })),
  }
}
