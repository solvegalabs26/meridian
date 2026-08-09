'use server'

import { createClient } from '@/lib/supabase/server'

export async function markAlertSeen(alertId: string): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase
    .from('watch_alerts')
    .update({ user_seen_at: new Date().toISOString() })
    .eq('id', alertId)
    .eq('user_id', user.id)

  return !error
}
