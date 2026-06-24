import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ObjectivesClient from './ObjectivesClient'

export default async function ObjectivesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: objectives, error } = await supabase
    .from('objectives')
    .select('*')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })

  return (
    <ObjectivesClient
      objectives={objectives ?? []}
      error={error?.message ?? null}
    />
  )
}
