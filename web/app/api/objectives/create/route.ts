// POST /api/objectives/create — MIP Objective Intake
// Core: intake contract is universal. org_source is the cohort partition key.
// Third-vertical test: BaseMaps, GoHunt, and FishBrain all POST to this same route — YES
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveAgentBundle } from '@/lib/swarm/objectiveRouter'
import { resolveNWSGridpoint } from '@/lib/geo/nwsGridpoint'

export const dynamic = 'force-dynamic'

type CreateObjectiveBody = {
  domain: string
  taxonomy_key: string
  geo: { state?: string; unit?: string; lat?: number; lon?: number }
  priority_stack: unknown[]
  timing: Record<string, unknown>
  org_source?: string
  user_id?: string
}

export async function POST(request: NextRequest) {
  const supabase = createServiceClient()

  let body: CreateObjectiveBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { domain, taxonomy_key, geo, priority_stack, timing } = body
  const org_source = body.org_source ?? 'arc'

  if (!domain || !taxonomy_key || !geo || !priority_stack || !timing) {
    return NextResponse.json(
      { error: 'Missing required fields: domain, taxonomy_key, geo, priority_stack, timing' },
      { status: 400 }
    )
  }

  // Resolve agent bundle from registry
  const { agents, buildStatus } = await resolveAgentBundle(taxonomy_key, geo)

  // Determine user from explicit user_id (authenticated intake) or org_source service account
  let profile: { id: string } | null = null
  if (body.user_id) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', body.user_id)
      .maybeSingle()
    profile = data
  } else {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('org_source', org_source)
      .limit(1)
      .maybeSingle()
    profile = data
  }

  // If BaseMaps org_source → set account_type = enterprise on their profile
  if (org_source === 'basemaps' && profile) {
    await supabase
      .from('profiles')
      .update({ account_type: 'enterprise' })
      .eq('id', profile.id)
  }

  const { lat, lon } = geo

  // Insert objective_profiles row
  const { data: objProfile, error: insertError } = await supabase
    .from('objective_profiles')
    .insert({
      user_id: profile?.id ?? null,
      org_source,
      domain,
      taxonomy_key,
      geo,
      priority_stack,
      timing,
      assigned_agents: agents,
      agent_build_status: buildStatus === 'ready'
        ? 'ready'
        : buildStatus === 'partial'
          ? 'building'
          : 'queued',
      status: 'active',
      ...(lat != null ? { lat } : {}),
      ...(lon != null ? { lon } : {}),
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('[objectives/create] insert failed', insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Resolve NWS gridpoint if lat/lon provided — non-blocking, best-effort
  if (lat != null && lon != null && objProfile?.id) {
    void resolveNWSGridpoint(lat, lon).then(async (grid) => {
      if (!grid) return
      await supabase
        .from('objective_profiles')
        .update({
          nws_grid_office: grid.gridOffice,
          nws_grid_x: grid.gridX,
          nws_grid_y: grid.gridY,
          nws_zone_id: grid.zoneId,
        })
        .eq('id', objProfile.id)
    }).catch(e => console.error('[objectives/create] gridpoint update failed:', e))
  }

  return NextResponse.json(
    {
      objective_id: objProfile.id,
      assigned_agents: agents,
      agent_build_status: objProfile ? 'ready' : buildStatus,
    },
    { status: 201 }
  )
}
