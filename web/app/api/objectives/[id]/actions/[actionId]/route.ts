import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; actionId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch the action to get the signal_id before deletion (for cleanup)
  const { data: action } = await supabase
    .from('objective_actions')
    .select('id, signal_id, user_id')
    .eq('id', params.actionId)
    .eq('objective_id', params.id)
    .single()

  if (!action || action.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Delete the action row — RLS also enforces ownership
  const { error } = await supabase
    .from('objective_actions')
    .delete()
    .eq('id', params.actionId)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Clean up the emitted signal if it's a user_action (no downstream references)
  if (action.signal_id) {
    await supabase
      .from('signals')
      .delete()
      .eq('id', action.signal_id)
      .eq('signal_class', 'user_action')
      .eq('user_id', user.id)
  }

  return NextResponse.json({ ok: true })
}
