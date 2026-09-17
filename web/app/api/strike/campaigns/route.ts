import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const authClient = createClient()
    const { data: { session }, error: sessionErr } = await authClient.auth.getSession()
    console.log('[campaigns] session:', session?.user?.id ?? 'NULL', 'error:', sessionErr?.message)

    if (sessionErr || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    console.log('[campaigns] userId:', userId)

    const supabase = createServiceClient()
    const { data: campaigns, error: campErr } = await supabase
      .from('hunt_campaigns')
      .select('id, name, status, user_id')
      .eq('user_id', userId)
      .eq('status', 'active')

    console.log('[campaigns] raw result:', JSON.stringify({ campaigns, campErr }))

    return NextResponse.json({ campaigns: campaigns ?? [] })
  } catch (err) {
    console.error('[campaigns] unhandled error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
