import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireAdminUser } from '@/lib/admin/requireAdminUser'

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const admin = await requireAdminUser(supabase)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const adminClient = createServiceClient()
  const { error } = await adminClient
    .from('support_messages')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
      read_by: admin.id,
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
