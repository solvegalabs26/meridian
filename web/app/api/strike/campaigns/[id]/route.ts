import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  // Fetch single campaign — ownership check via user_id
  const { data: campaign, error: campErr } = await supabase
    .from('hunt_campaigns')
    .select('*, campaign_units(*)')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (campErr || !campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const units = (campaign.campaign_units ?? []) as { objective_id: string; rank: number }[]
  const objectiveIds = units.map(u => u.objective_id)

  if (objectiveIds.length === 0) return NextResponse.json({ campaign: { ...campaign, campaign_units: [] } })

  // Bulk fetch objective_profiles
  const { data: profiles } = await supabase
    .from('objective_profiles')
    .select('objective_id, taxonomy_key, geo, timing, agent_build_status')
    .in('objective_id', objectiveIds)

  const profileMap = Object.fromEntries(
    (profiles ?? []).map((p: { objective_id: string }) => [p.objective_id, p])
  )

  // Bulk fetch latest strike_briefs (today first, fallback to most recent)
  const today = new Date().toISOString().split('T')[0]
  const { data: briefs } = await supabase
    .from('strike_briefs')
    .select('objective_id, brief_date, time_window, synthesis, lead_signal, go_no_go, confidence_tier, movement_windows, terrain_intel')
    .in('objective_id', objectiveIds)
    .order('brief_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(objectiveIds.length * 3)

  // Keep most recent brief per objective_id (today preferred, fallback to newest date)
  const briefMap: Record<string, unknown> = {}
  for (const b of (briefs ?? [])) {
    const bid = (b as { objective_id: string }).objective_id
    if (!briefMap[bid]) {
      briefMap[bid] = b
    } else if ((b as { brief_date: string }).brief_date === today && (briefMap[bid] as { brief_date: string }).brief_date !== today) {
      briefMap[bid] = b
    }
  }

  const enriched = {
    ...campaign,
    campaign_units: units
      .sort((a, b) => a.rank - b.rank)
      .map(unit => ({
        ...unit,
        objective_profile: profileMap[unit.objective_id] ?? null,
        latest_brief: briefMap[unit.objective_id] ?? null,
      })),
  }

  return NextResponse.json({ campaign: enriched })
}
