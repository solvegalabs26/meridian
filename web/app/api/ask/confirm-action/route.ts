// app/api/ask/confirm-action/route.ts
// FF-018 Phase C — writes a user-confirmed suggested action to objective_actions.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { action_text?: string; objective_ids?: string[]; ask_query_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { action_text, objective_ids = [], ask_query_id } = body

  if (!action_text?.trim()) {
    return NextResponse.json({ error: 'action_text is required' }, { status: 400 })
  }

  // objective_id is NOT NULL in schema — skip insert if no objective linked.
  // The action is still captured by Phase B's extracted_signals on the ask_query.
  if (objective_ids.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'no_objective' })
  }

  const rows = objective_ids.map(objective_id => ({
    objective_id,
    user_id: user.id,
    description: action_text.trim(),
    source: 'ask_suggested',
    status: 'pending',
    ask_query_id: ask_query_id ?? null,
  }))

  const { error: insertError } = await supabase
    .from('objective_actions')
    .insert(rows)

  if (insertError) {
    console.error('[confirm-action] insert failed:', insertError.message)
    return NextResponse.json({ error: 'Failed to save action.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
