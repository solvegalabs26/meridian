import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  // Verify campaign ownership
  const { data: campaign } = await supabase
    .from('hunt_campaigns')
    .select('id, domain, taxonomy_key')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const body = await req.json()

  let objectiveId: string

  if (body.objective_id) {
    // Existing objective — just add the unit
    objectiveId = body.objective_id as string
  } else if (body.geo && body.taxonomy_key) {
    // Create stub objectives row + objective_profile, then add unit
    const newObjId = randomUUID()
    const geoData = body.geo as Record<string, string>
    const unitLabel = geoData.unit ?? 'Unknown'
    const statLabel = geoData.state ?? ''

    // Insert stub objectives row (required by objective_profiles FK)
    const { error: objErr } = await supabase
      .from('objectives')
      .insert({
        id: newObjId,
        user_id: user.id,
        obj_id: `OBJ-${unitLabel}`,
        title: `${unitLabel} ${statLabel} — Hunt Unit`.trim(),
        category: 'hunting',
        outcome: 'harvest_elk',
        deadline_type: 'hard',
        context: { org_source: 'strike' },
      })

    if (objErr) return NextResponse.json({ error: `objectives insert: ${objErr.message}` }, { status: 500 })

    // Insert objective_profile
    const { error: profErr } = await supabase
      .from('objective_profiles')
      .insert({
        objective_id: newObjId,
        user_id: user.id,
        org_source: 'strike',
        domain: campaign.domain,
        taxonomy_key: (body.taxonomy_key as string) ?? campaign.taxonomy_key,
        geo: body.geo,
        timing: body.timing ?? null,
        agent_build_status: 'ready',
        status: 'active',
      })

    if (profErr) return NextResponse.json({ error: `objective_profiles insert: ${profErr.message}` }, { status: 500 })

    objectiveId = newObjId
  } else {
    return NextResponse.json(
      { error: 'Provide either objective_id or { geo, taxonomy_key } to create a new unit' },
      { status: 400 }
    )
  }

  const role = (body.role as string) ?? 'fallback_1'
  const rank = typeof body.rank === 'number' ? body.rank : 2

  const { data: unit, error: unitErr } = await supabase
    .from('campaign_units')
    .insert({
      campaign_id: params.id,
      objective_id: objectiveId,
      role,
      rank,
      status: 'active',
    })
    .select('id')
    .single()

  if (unitErr || !unit) {
    return NextResponse.json({ error: unitErr?.message ?? 'Unit insert failed' }, { status: 500 })
  }

  return NextResponse.json({ campaign_unit_id: unit.id, objective_id: objectiveId }, { status: 201 })
}
