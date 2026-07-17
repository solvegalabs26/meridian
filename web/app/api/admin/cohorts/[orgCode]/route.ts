import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireAdminUser } from '@/lib/admin/requireAdminUser'

export const dynamic = 'force-dynamic'

// orgCode param receives the UUID when called from the config drawer
// (PATCH /api/admin/cohorts/<uuid>) and the org code string when called
// from report routes deeper in the tree.

export async function PATCH(
  req: NextRequest,
  { params }: { params: { orgCode: string } }
) {
  const supabase = createClient()
  const admin = await requireAdminUser(supabase)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as Record<string, unknown>
  const service = createServiceClient()

  const { data: config, error } = await service
    .from('cohort_report_configs')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.orgCode)
    .select()
    .single()

  if (error) {
    console.error('[cohorts PATCH]', error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ config })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { orgCode: string } }
) {
  const supabase = createClient()
  const admin = await requireAdminUser(supabase)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()
  const { error } = await service
    .from('cohort_report_configs')
    .delete()
    .eq('id', params.orgCode)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
