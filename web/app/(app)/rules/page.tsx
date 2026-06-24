import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RulesClient from './RulesClient'

export default async function RulesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: objectives }, { data: rules }] = await Promise.all([
    supabase.from('objectives').select('id, obj_id, title').eq('user_id', user.id).eq('status', 'active').order('sort_order'),
    supabase.from('rules_filter').select('*').eq('user_id', user.id),
  ])

  return (
    <RulesClient
      objectives={objectives ?? []}
      initialRules={rules ?? []}
    />
  )
}
