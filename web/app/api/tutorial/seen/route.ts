import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Self-limiting increment: the SQL guard (tutorial_views_count < 2) ensures
// this can never push the counter past 2, even on duplicate calls.
export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase.rpc('increment_tutorial_views', { uid: user.id })

  if (error) {
    // Non-fatal — the tutorial still renders and dismisses; worst case the
    // user sees it one extra time on next login.
    console.error('[tutorial/seen]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
