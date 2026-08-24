import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ObjectivesClient from './ObjectivesClient'

export default async function ObjectivesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: objectives, error }, { data: unseenAlerts }] = await Promise.all([
    supabase
      .from('objectives')
      .select('*, objective_outcomes(outcome_type, outcome_note, actual_completed_at, swept_at_close, prediction_id, recorded_at)')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('watch_alerts')
      .select('objective_id')
      .eq('user_id', user.id)
      .is('user_seen_at', null),
  ])

  const alertObjectiveIds = new Set(
    (unseenAlerts ?? []).map(a => a.objective_id as string).filter(Boolean)
  )

  return (
    <ObjectivesClient
      objectives={objectives ?? []}
      error={error?.message ?? null}
      alertObjectiveIds={alertObjectiveIds}
    />
  )
}
