'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { runPortfolioSweep } from '@/lib/enterprise/sweep-fork1'
import { runObjectiveSweep } from '@/lib/enterprise/sweep-fork2'
import { runREPortfolioSweep } from '@/lib/enterprise/sweep-fork1-re'
import { runREObjectiveSweep } from '@/lib/enterprise/sweep-fork2-re'
import type { ObjectiveState } from '@/lib/enterprise/objectives-queries'

export async function updateObjectiveState(
  objectiveId: string,
  newState: ObjectiveState
): Promise<{ ok: boolean; error?: string }> {
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('enterprise_objectives')
    .update({ objective_state: newState })
    .eq('id', objectiveId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function runEnterpriseSweep(
  institutionId: string
): Promise<{ ok: boolean; error?: string; objectivesSwept?: number }> {
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }

  const supabase = createServiceClient()

  const { data: institution } = await supabase
    .from('enterprise_institutions')
    .select('id, industry')
    .eq('id', institutionId)
    .single()

  if (!institution) return { ok: false, error: 'Institution not found' }

  const isRE = (institution as { industry?: string | null }).industry === 'real_estate'

  let fork1Result
  try {
    fork1Result = isRE
      ? await runREPortfolioSweep(institutionId)
      : await runPortfolioSweep(institutionId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `Portfolio sweep failed: ${msg}` }
  }

  const { data: objectives } = await supabase
    .from('enterprise_objectives')
    .select('id, obj_id')
    .eq('institution_id', institutionId)
    .eq('status', 'active')
    .eq('objective_state', 'focus')
    .order('objective_order')

  const settled = await Promise.allSettled(
    (objectives ?? []).map(obj =>
      isRE
        ? runREObjectiveSweep(institutionId, obj.id as string, fork1Result.metricsId)
        : runObjectiveSweep(institutionId, obj.id as string, fork1Result.metricsId)
    )
  )

  const swept = settled.filter(r => r.status === 'fulfilled').length
  const failed = settled.filter(r => r.status === 'rejected').length

  if (failed > 0) {
    console.error(`[FF-035-C] ${failed} objective sweep(s) failed`)
  }

  return { ok: true, objectivesSwept: swept }
}

export async function updateSignalPreferences(
  institutionId: string,
  preferences: Record<string, boolean>
): Promise<{ ok: boolean; error?: string }> {
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }

  const supabase = createServiceClient()

  // Read current config, merge signal_preferences key, write back
  const { data: inst } = await supabase
    .from('enterprise_institutions')
    .select('config')
    .eq('id', institutionId)
    .single()

  const currentConfig = (inst?.config as Record<string, unknown>) ?? {}
  const { error } = await supabase
    .from('enterprise_institutions')
    .update({ config: { ...currentConfig, signal_preferences: preferences } })
    .eq('id', institutionId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
