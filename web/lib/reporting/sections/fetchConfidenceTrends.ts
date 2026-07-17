import type { ReportingClient, ConfidenceTrendsData } from '../types'

export async function fetchConfidenceTrends(
  service: ReportingClient,
  userIds: string[]
): Promise<ConfidenceTrendsData> {
  if (userIds.length === 0) return { cycles: [] }

  // Use objective_episodes ordered by created_at, group into 4 buckets
  const { data: episodes } = await service
    .from('objective_episodes')
    .select('confidence_end, created_at')
    .in('user_id', userIds)
    .not('confidence_end', 'is', null)
    .order('created_at', { ascending: false })
    .limit(2000)

  if (!episodes || episodes.length === 0) return { cycles: [] }

  // Bucket into 4 equal time windows from oldest to newest
  const sorted = [...episodes].sort(
    (a, b) => new Date(a.created_at as string).getTime() - new Date(b.created_at as string).getTime()
  )
  const chunkSize = Math.ceil(sorted.length / 4)
  const cycles: { label: string; avgConfidence: number }[] = []

  for (let i = 0; i < 4; i++) {
    const chunk = sorted.slice(i * chunkSize, (i + 1) * chunkSize)
    if (chunk.length === 0) continue
    const avg = Math.round(chunk.reduce((s, e) => s + ((e.confidence_end as number) ?? 50), 0) / chunk.length)
    const date = new Date(chunk[chunk.length - 1].created_at as string)
    const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    cycles.push({ label, avgConfidence: avg })
  }

  return { cycles }
}
