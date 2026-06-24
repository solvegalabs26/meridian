import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PredictionsClient from './PredictionsClient'

export default async function PredictionsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: predictions }, { data: objectives }] = await Promise.all([
    supabase
      .from('predictions')
      .select('*, objectives(obj_id, title)')
      .eq('user_id', user.id)
      .order('horizon_date', { ascending: true }),
    supabase
      .from('objectives')
      .select('id, obj_id, title')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('sort_order'),
  ])

  return (
    <PredictionsClient
      initialPredictions={predictions ?? []}
      objectives={objectives ?? []}
    />
  )
}
