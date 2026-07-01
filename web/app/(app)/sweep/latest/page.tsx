import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function LatestSweepRedirect() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: lastSweep } = await supabase
    .from('sweeps')
    .select('id')
    .eq('user_id', user!.id)
    .eq('status', 'complete')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single()

  redirect(lastSweep ? `/sweep/${lastSweep.id}` : '/dashboard')
}
