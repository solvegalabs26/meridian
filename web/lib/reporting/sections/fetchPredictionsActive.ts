import type { ReportingClient, PredictionsActiveData } from '../types'

export async function fetchPredictionsActive(
  service: ReportingClient,
  userIds: string[]
): Promise<PredictionsActiveData> {
  if (userIds.length === 0) {
    return { totalPredictions: 0, avgHorizonDays: 0, pctPendingOutcome: 0 }
  }

  const { data: predictions } = await service
    .from('predictions')
    .select('horizon_date, outcome')
    .in('user_id', userIds)

  if (!predictions || predictions.length === 0) {
    return { totalPredictions: 0, avgHorizonDays: 0, pctPendingOutcome: 0 }
  }

  const now = new Date()
  let horizonSum = 0
  let pending = 0

  for (const p of predictions) {
    const horizon = new Date(p.horizon_date as string)
    horizonSum += Math.max(0, (horizon.getTime() - now.getTime()) / 86400000)
    if (!p.outcome) pending++
  }

  return {
    totalPredictions: predictions.length,
    avgHorizonDays: Math.round(horizonSum / predictions.length),
    pctPendingOutcome: Math.round((pending / predictions.length) * 100),
  }
}
