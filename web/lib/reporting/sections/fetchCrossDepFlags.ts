import type { ReportingClient, CrossDepFlagsData } from '../types'

export async function fetchCrossDepFlags(
  service: ReportingClient,
  userIds: string[],
  periodStart: Date
): Promise<CrossDepFlagsData> {
  if (userIds.length === 0) {
    return { totalCrossDepFlags: 0, objectivesWithFlags: 0 }
  }

  // objective_episodes.cross_deps_detected is a jsonb array of detected cross-deps
  const { data: episodes } = await service
    .from('objective_episodes')
    .select('cross_deps_detected, objective_id')
    .in('user_id', userIds)
    .gte('created_at', periodStart.toISOString())
    .not('cross_deps_detected', 'is', null)

  let totalFlags = 0
  const objectivesWithFlags = new Set<string>()

  for (const ep of episodes ?? []) {
    const deps = ep.cross_deps_detected as unknown[]
    if (Array.isArray(deps) && deps.length > 0) {
      totalFlags += deps.length
      objectivesWithFlags.add(ep.objective_id as string)
    }
  }

  return {
    totalCrossDepFlags: totalFlags,
    objectivesWithFlags: objectivesWithFlags.size,
  }
}
