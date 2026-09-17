import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, season_year, domain, taxonomy_key, first_unit } = body as {
    name?: string
    season_year: number
    domain: string
    taxonomy_key: string
    first_unit: { objective_id: string; geo?: Record<string, unknown> }
  }

  if (!season_year || !domain || !taxonomy_key || !first_unit?.objective_id) {
    return NextResponse.json(
      { error: 'season_year, domain, taxonomy_key, and first_unit.objective_id are required' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  // Create campaign
  const { data: campaign, error: campErr } = await supabase
    .from('hunt_campaigns')
    .insert({
      user_id: user.id,
      org_source: 'strike',
      season_year,
      domain,
      taxonomy_key,
      name: name ?? null,
      status: 'active',
    })
    .select('id')
    .single()

  if (campErr || !campaign) {
    return NextResponse.json({ error: campErr?.message ?? 'Campaign insert failed' }, { status: 500 })
  }

  // Create first campaign_unit as primary
  const { data: unit, error: unitErr } = await supabase
    .from('campaign_units')
    .insert({
      campaign_id: campaign.id,
      objective_id: first_unit.objective_id,
      role: 'primary',
      rank: 1,
      status: 'active',
    })
    .select('id')
    .single()

  if (unitErr || !unit) {
    return NextResponse.json({ error: unitErr?.message ?? 'Unit insert failed' }, { status: 500 })
  }

  return NextResponse.json({ campaign_id: campaign.id, campaign_unit_id: unit.id }, { status: 201 })
}
