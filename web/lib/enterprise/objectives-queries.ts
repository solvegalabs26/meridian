import type { SupabaseClient } from '@supabase/supabase-js'

export type ObjectiveState = 'focus' | 'monitoring_lite' | 'paused'
export type LiteTrend = 'improving' | 'stable' | 'deteriorating' | 'unknown'

export type ObjectiveResult = {
  id: string
  sweep_type: 'full' | 'lite'
  confidence_score: number
  alert_triggered: boolean
  affecting_it: string | null
  implies: string | null
  signals: string | null
  what_to_do: string | null
  lite_metric_1_label: string | null
  lite_metric_1_value: string | null
  lite_metric_2_label: string | null
  lite_metric_2_value: string | null
  lite_trend: LiteTrend | null
  lite_summary: string | null
  computed_at: string
}

export type ObjectiveWithResult = {
  id: string
  obj_id: string
  title: string
  statement: string
  objective_state: ObjectiveState
  objective_order: number
  lite_sweep_cadence_days: number | null
  last_focus_sweep_at: string | null
  last_lite_sweep_at: string | null
  latest_result: ObjectiveResult | null
}

type RawObjective = {
  id: string
  obj_id: string
  title: string
  statement: string
  objective_state: ObjectiveState
  objective_order: number
  lite_sweep_cadence_days: number | null
  last_focus_sweep_at: string | null
  last_lite_sweep_at: string | null
  enterprise_objective_results: ObjectiveResult[]
}

export async function getObjectivesWithResults(
  supabase: SupabaseClient,
  institutionId: string
): Promise<ObjectiveWithResult[]> {
  const { data } = await supabase
    .from('enterprise_objectives')
    .select(`
      id, obj_id, title, statement, objective_state,
      objective_order, lite_sweep_cadence_days,
      last_focus_sweep_at, last_lite_sweep_at,
      enterprise_objective_results (
        id, sweep_type, confidence_score, alert_triggered,
        affecting_it, implies, signals, what_to_do,
        lite_metric_1_label, lite_metric_1_value,
        lite_metric_2_label, lite_metric_2_value,
        lite_trend, lite_summary, computed_at
      )
    `)
    .eq('institution_id', institutionId)
    .eq('status', 'active')
    .order('objective_order', { ascending: true })

  if (!data) return []

  return (data as RawObjective[]).map(obj => ({
    ...obj,
    enterprise_objective_results: undefined as unknown as ObjectiveResult[],
    latest_result: (obj.enterprise_objective_results ?? [])
      .sort((a, b) => new Date(b.computed_at).getTime() - new Date(a.computed_at).getTime())[0] ?? null,
  }))
}

export async function getLatestPortfolioMetrics(supabase: SupabaseClient, institutionId: string) {
  const { data } = await supabase
    .from('enterprise_portfolio_metrics')
    .select('portfolio_health_score, health_trend, key_findings, computed_at')
    .eq('institution_id', institutionId)
    .order('computed_at', { ascending: false })
    .limit(1)
    .single()
  return data ?? null
}
