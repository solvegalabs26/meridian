// lib/sweep/getRecentAskContext.ts
// FF-018 Phase D — fetch recent Ask Meridian queries linked to an objective
// via the signals table and format them as a prompt context block.

import type { SupabaseClient } from '@supabase/supabase-js'

export async function getRecentAskContext(
  supabase: SupabaseClient,
  userId: string,
  objectiveId: string,
  limit = 5
): Promise<string> {
  const { data, error } = await supabase
    .from('signals')
    .select('ask_query_id, ask_queries(question, response, created_at)')
    .eq('user_id', userId)
    .eq('source', 'ask_query')
    .contains('objective_ids', [objectiveId])
    .not('ask_query_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data || data.length === 0) return ''

  const seen = new Set<string>()
  const queries = data
    .filter(row => {
      if (!row.ask_query_id || seen.has(row.ask_query_id)) return false
      seen.add(row.ask_query_id)
      return true
    })
    .map(row => {
      // Supabase returns joined rows as an array even for FK-singular relations
      const raw = row.ask_queries
      const q = (Array.isArray(raw) ? raw[0] : raw) as { question: string; response: string; created_at: string } | null
      if (!q) return null
      const date = new Date(q.created_at).toLocaleDateString()
      return `Q (${date}): ${q.question}\nA: ${q.response.slice(0, 400)}${q.response.length > 400 ? '...' : ''}`
    })
    .filter((q): q is string => q !== null)

  if (queries.length === 0) return ''

  return `## User's recent questions about this objective\n${queries.join('\n\n---\n\n')}`
}
