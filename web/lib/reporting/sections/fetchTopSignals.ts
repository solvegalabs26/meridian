import type { ReportingClient, TopSignalsData } from '../types'

export async function fetchTopSignals(
  service: ReportingClient,
  userIds: string[],
  periodStart: Date
): Promise<TopSignalsData> {
  if (userIds.length === 0) return { keywords: [] }

  // Aggregate top_signals jsonb from objective_episodes
  // top_signals is a jsonb array of {keyword, relevance} or similar objects
  const { data: episodes } = await service
    .from('objective_episodes')
    .select('top_signals')
    .in('user_id', userIds)
    .gte('created_at', periodStart.toISOString())
    .not('top_signals', 'is', null)

  const freq: Record<string, number> = {}

  for (const ep of episodes ?? []) {
    const signals = ep.top_signals as unknown[]
    if (!Array.isArray(signals)) continue
    for (const sig of signals) {
      let kw: string | undefined
      if (typeof sig === 'string') kw = sig
      else if (sig && typeof sig === 'object') {
        const s = sig as Record<string, unknown>
        kw = (s.keyword ?? s.term ?? s.signal ?? s.label) as string | undefined
      }
      if (kw) freq[kw.toLowerCase()] = (freq[kw.toLowerCase()] ?? 0) + 1
    }
  }

  const keywords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([keyword, count]) => ({ keyword, count }))

  return { keywords }
}
