import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SignalFeedClient from './SignalFeedClient'

export default async function SignalsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: signals }, { data: objectives }] = await Promise.all([
    supabase
      .from('signals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('objectives')
      .select('id, title, obj_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('sort_order'),
  ])

  return (
    <SignalFeedClient
      initialSignals={signals ?? []}
      objectives={objectives ?? []}
    />
  )
}
