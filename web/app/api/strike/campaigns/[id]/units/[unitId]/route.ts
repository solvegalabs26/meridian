import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; unitId: string } }
) {
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  // Verify campaign ownership
  const { data: campaign } = await supabase
    .from('hunt_campaigns')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  // Fetch the unit to get its objective_id for geo updates
  const { data: existing } = await supabase
    .from('campaign_units')
    .select('id, objective_id, status')
    .eq('id', params.unitId)
    .eq('campaign_id', params.id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Unit not found' }, { status: 404 })

  const body = await req.json() as {
    role?: string
    rank?: number
    status?: string
    missed_reason?: string
    geo?: Record<string, unknown>
    timing?: Record<string, unknown>
  }

  // Enforce missed_reason when marking missed
  const newStatus = body.status ?? existing.status
  if (newStatus === 'missed' && !body.missed_reason) {
    return NextResponse.json({ error: 'missed_reason is required when status is missed' }, { status: 400 })
  }

  // Build unit update payload
  const unitUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.role !== undefined)         unitUpdate.role = body.role
  if (body.rank !== undefined)         unitUpdate.rank = body.rank
  if (body.status !== undefined)       unitUpdate.status = body.status
  if (body.missed_reason !== undefined) unitUpdate.missed_reason = body.missed_reason

  const { data: updated, error: updateErr } = await supabase
    .from('campaign_units')
    .update(unitUpdate)
    .eq('id', params.unitId)
    .select()
    .single()

  if (updateErr || !updated) {
    return NextResponse.json({ error: updateErr?.message ?? 'Update failed' }, { status: 500 })
  }

  // If geo or timing changed — propagate to objective_profiles
  if (body.geo !== undefined || body.timing !== undefined) {
    const profileUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.geo !== undefined)    profileUpdate.geo = body.geo
    if (body.timing !== undefined) profileUpdate.timing = body.timing

    await supabase
      .from('objective_profiles')
      .update(profileUpdate)
      .eq('objective_id', existing.objective_id)
  }

  return NextResponse.json({ unit: updated })
}
