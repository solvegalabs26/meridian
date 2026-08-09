import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { action: 'confirm' | 'remove' }
  if (!body.action) return NextResponse.json({ error: 'action required' }, { status: 400 })

  const update =
    body.action === 'confirm'
      ? { requires_confirmation: false }
      : { is_active: false }

  const svc = createServiceClient()
  const { error } = await svc
    .from('watch_sources')
    .update(update)
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
