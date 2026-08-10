import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json(null, { status: 401 })

  const [{ data: alert }, { count: unseenCount }] = await Promise.all([
    supabase
      .from('watch_alerts')
      .select('id, signal_summary, action_text, direct_url, objective_id')
      .eq('user_id', user.id)
      .is('user_seen_at', null)
      .eq('alert_level', 'critical')
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('watch_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('user_seen_at', null),
  ])

  if (!alert) return NextResponse.json(null)

  let objectiveTitle = ''
  if (alert.objective_id) {
    const { data: obj } = await supabase
      .from('objectives')
      .select('title')
      .eq('id', alert.objective_id as string)
      .single()
    objectiveTitle = (obj?.title as string | undefined) ?? ''
  }

  return NextResponse.json({
    id: alert.id,
    signal_summary: alert.signal_summary,
    action_text: alert.action_text,
    direct_url: alert.direct_url,
    objective_title: objectiveTitle,
    unseen_count: unseenCount ?? 0,
  })
}
