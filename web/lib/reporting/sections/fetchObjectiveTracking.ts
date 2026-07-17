import type { ReportingClient, ObjectiveTrackingData } from '../types'

export async function fetchObjectiveTracking(
  service: ReportingClient,
  userIds: string[]
): Promise<ObjectiveTrackingData> {
  if (userIds.length === 0) {
    return { byCategory: [], pctWithTargetDate: 0 }
  }

  const { data: objectives } = await service
    .from('objectives')
    .select('category, confidence, target_date')
    .in('user_id', userIds)
    .eq('status', 'active')

  if (!objectives || objectives.length === 0) {
    return { byCategory: [], pctWithTargetDate: 0 }
  }

  // Group by category
  const catMap: Record<string, { total: number; confSum: number }> = {}
  let withDate = 0

  for (const obj of objectives) {
    const cat = (obj.category as string) ?? 'other'
    if (!catMap[cat]) catMap[cat] = { total: 0, confSum: 0 }
    catMap[cat].total++
    catMap[cat].confSum += (obj.confidence as number) ?? 50
    if (obj.target_date) withDate++
  }

  const byCategory = Object.entries(catMap)
    .map(([category, { total, confSum }]) => ({
      category,
      count: total,
      avgConfidence: Math.round(confSum / total),
    }))
    .sort((a, b) => b.count - a.count)

  return {
    byCategory,
    pctWithTargetDate: Math.round((withDate / objectives.length) * 100),
  }
}
