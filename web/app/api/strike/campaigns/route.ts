import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  // Fetch campaigns + units for this user
  const { data: campaigns, error: campErr } = await supabase
    .from('hunt_campaigns')
    .select('*, campaign_units(*)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (campErr) return NextResponse.json({ error: campErr.message }, { status: 500 })
  if (!campaigns || campaigns.length === 0) return NextResponse.json({ campaigns: [] })

  // Collect all unique objective_ids across all units
  const allObjectiveIds = Array.from(
    new Set(
      campaigns.flatMap((c: { campaign_units: { objective_id: string }[] }) =>
        (c.campaign_units ?? []).map((u: { objective_id: string }) => u.objective_id)
      )
    )
  ) as string[]

  // Bulk fetch objective_profiles
  const { data: profiles } = await supabase
    .from('objective_profiles')
    .select('objective_id, taxonomy_key, geo, timing, agent_build_status')
    .in('objective_id', allObjectiveIds)

  const profileMap = Object.fromEntries(
    (profiles ?? []).map((p: { objective_id: string }) => [p.objective_id, p])
  )

  // Bulk fetch latest strike_brief per objective_id (one per day, most recent)
  const today = new Date().toISOString().split('T')[0]
  const { data: briefs } = await supabase
    .from('strike_briefs')
    .select('objective_id, brief_date, time_window, synthesis, lead_signal, go_no_go, confidence_tier, movement_windows')
    .in('objective_id', allObjectiveIds)
    .eq('brief_date', today)
    .order('created_at', { ascending: false })

  // Keep only latest brief per objective_id (first row wins after desc created_at sort)
  const briefMap: Record<string, unknown> = {}
  for (const b of (briefs ?? [])) {
    if (!(b as { objective_id: string }).objective_id || briefMap[(b as { objective_id: string }).objective_id]) continue
    briefMap[(b as { objective_id: string }).objective_id] = b
  }

  // Merge: attach profile + brief to each unit
  const enriched = campaigns.map((campaign) => ({
    ...campaign,
    campaign_units: (campaign.campaign_units ?? [])
      .sort((a: { rank: number }, b: { rank: number }) => a.rank - b.rank)
      .map((unit: { objective_id: string }) => ({
        ...unit,
        objective_profile: profileMap[unit.objective_id] ?? null,
        latest_brief: briefMap[unit.objective_id] ?? null,
      })),
  }))

  return NextResponse.json({ campaigns: enriched })
}
