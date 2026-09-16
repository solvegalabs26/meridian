// GET /api/mip/brief?objective_id=uuid&partner_key=basemaps
// Core — MIP standardized output schema, partner-agnostic
// Third-vertical test: GoHunt and FishBrain consume identical payload — YES
// Step 6: partner_key=basemaps adds X-MIP-Partner header; attribution always 'Powered by Meridian Arc'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type SignalChip = { label: string; value: string; status: 'ok' | 'warn' | 'critical' }
type TimeWindow = { window: string; action: string; priority: 'high' | 'medium' | 'low' }
type MapPin = { type: string; lat: number; lon: number; confidence: string; label: string }

type MipBriefPayload = {
  objective_id: string
  brief_generated_at: string
  confidence_tier: number
  confidence_pct: number
  summary: string
  signal_chips: SignalChip[]
  time_windows: TimeWindow[]
  map_pins: MapPin[]
  sources: string[]
  attribution: 'Powered by Meridian Arc'
}

function pendingResponse(objectiveId: string): MipBriefPayload {
  return {
    objective_id: objectiveId,
    brief_generated_at: new Date().toISOString(),
    confidence_tier: 4,
    confidence_pct: 0,
    summary: 'Intelligence sweep pending — check back after next scheduled run.',
    signal_chips: [],
    time_windows: [],
    map_pins: [],
    sources: [],
    attribution: 'Powered by Meridian Arc',
  }
}

function confidenceTier(pct: number): number {
  if (pct >= 75) return 1
  if (pct >= 50) return 2
  if (pct >= 25) return 3
  return 4
}

// strike_briefs.confidence_tier stores 'T1'/'T2'/'T3'/'T4' text
function briefTierToInt(tier: string | null): number {
  if (!tier) return 4
  const n = parseInt(tier.replace(/\D/g, ''), 10)
  return isNaN(n) ? 4 : Math.min(Math.max(n, 1), 4)
}

function agentKeyToLabel(key: string): string {
  // OUTDOOR_NOAA_TEMP → "NOAA Temp" · UNIV_FRED_CPI → "FRED CPI"
  const parts = key.split('_').slice(1)
  return parts.map(p => p.charAt(0) + p.slice(1).toLowerCase()).join(' ')
}

function chipStatus(result: string | null): 'ok' | 'warn' | 'critical' {
  if (result === 'hit') return 'ok'
  if (result === 'error') return 'critical'
  return 'warn'
}

function windowPriority(probability: number | null): 'high' | 'medium' | 'low' {
  if (probability == null) return 'low'
  if (probability >= 0.7) return 'high'
  if (probability >= 0.4) return 'medium'
  return 'low'
}

function pinConfidence(bedding: number | null): string {
  if (bedding == null) return 'low'
  if (bedding >= 0.7) return 'high'
  if (bedding >= 0.4) return 'moderate'
  return 'low'
}

function partnerHeaders(partnerKey: string | null): Record<string, string> {
  if (partnerKey === 'basemaps') return { 'X-MIP-Partner': 'basemaps' }
  return {}
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const objectiveId = searchParams.get('objective_id')
  const partnerKey = searchParams.get('partner_key')

  if (!objectiveId) {
    return NextResponse.json({ error: 'objective_id required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // 1. Resolve objective — try objective_profiles first (MIP-intake), then objectives (native Arc)
  let assignedAgents: string[] = []
  let nativeObjectiveId: string | null = null
  let confidencePct = 0

  const { data: profile } = await supabase
    .from('objective_profiles')
    .select('id, objective_id, assigned_agents')
    .eq('id', objectiveId)
    .maybeSingle()

  if (profile) {
    assignedAgents = (profile.assigned_agents as string[]) ?? []
    nativeObjectiveId = (profile.objective_id as string | null) ?? null
  } else {
    // Treat objectiveId as a native objectives.id
    const { data: obj } = await supabase
      .from('objectives')
      .select('id, confidence')
      .eq('id', objectiveId)
      .maybeSingle()
    if (obj) {
      nativeObjectiveId = obj.id as string
      confidencePct = (obj.confidence as number) ?? 0
    }
  }

  if (!profile && !nativeObjectiveId) {
    return NextResponse.json({ error: 'Objective not found' }, { status: 404 })
  }

  // No native objective linked yet — sweep data unavailable
  if (!nativeObjectiveId) {
    return NextResponse.json(pendingResponse(objectiveId), {
      headers: partnerHeaders(partnerKey),
    })
  }

  // 2. Most recent completed sweep that included this objective
  const { data: sweep } = await supabase
    .from('sweeps')
    .select('summary, completed_at')
    .contains('objectives_swept', [nativeObjectiveId])
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Pull confidence from objectives table if not already set
  if (confidencePct === 0) {
    const { data: obj } = await supabase
      .from('objectives')
      .select('confidence')
      .eq('id', nativeObjectiveId)
      .maybeSingle()
    confidencePct = (obj?.confidence as number) ?? 0
  }

  // 3. Signal chips — most recent run per agent in assigned_agents list
  const signalChips: SignalChip[] = []
  if (assignedAgents.length > 0) {
    const { data: runs } = await supabase
      .from('agent_run_log')
      .select('agent_key, result, threshold_value_observed, ran_at')
      .in('agent_key', assignedAgents)
      .order('ran_at', { ascending: false })

    const seen = new Set<string>()
    for (const run of (runs ?? [])) {
      if (seen.has(run.agent_key as string)) continue
      seen.add(run.agent_key as string)
      signalChips.push({
        label: agentKeyToLabel(run.agent_key as string),
        value: run.threshold_value_observed != null
          ? String(run.threshold_value_observed)
          : (run.result as string) ?? '—',
        status: chipStatus(run.result as string | null),
      })
    }
  }

  // 4. Time windows from most recent strike_brief
  const { data: brief } = await supabase
    .from('strike_briefs')
    .select('movement_windows, time_window, go_no_go, synthesis, confidence_tier')
    .eq('objective_id', nativeObjectiveId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const timeWindows: TimeWindow[] = []
  if (brief) {
    type MovementWindow = { time?: string; reason?: string; probability?: number }
    const mw = brief.movement_windows as MovementWindow[] | null
    if (Array.isArray(mw) && mw.length > 0) {
      for (const w of mw) {
        if (!w.time) continue
        timeWindows.push({
          window: w.time,
          action: w.reason ?? (brief.go_no_go as string) ?? '—',
          priority: windowPriority(w.probability ?? null),
        })
      }
    } else if (brief.time_window) {
      timeWindows.push({
        window: brief.time_window as string,
        action: (brief.go_no_go as string) ?? '—',
        priority: (brief.go_no_go as string) === 'GO' ? 'high' : 'low',
      })
    }
  }

  // Return pending only if neither sweep nor brief has any data
  if (!sweep && !brief) {
    return NextResponse.json(pendingResponse(objectiveId), {
      headers: partnerHeaders(partnerKey),
    })
  }

  // 5. Map pins from terrain_cache (empty array until FF-080 populates)
  const { data: terrainRows } = await supabase
    .from('terrain_cache')
    .select('lat, lon, slope_aspect, bedding_probability, terrain_interpretation, elevation_ft')
    .eq('objective_id', nativeObjectiveId)
    .not('lat', 'is', null)
    .limit(10)

  const mapPins: MapPin[] = (terrainRows ?? []).map(t => {
    const interp = t.terrain_interpretation as Record<string, unknown> | null
    return {
      type: (t.slope_aspect as string) ?? 'terrain',
      lat: Number(t.lat),
      lon: Number(t.lon),
      confidence: pinConfidence(t.bedding_probability as number | null),
      label: (interp?.label as string) ?? (t.elevation_ft ? `${t.elevation_ft}ft` : 'Terrain point'),
    }
  })

  // 6. Sources
  const sources: string[] = []
  if (sweep) sources.push('Meridian Arc Swarm')
  if ((terrainRows ?? []).length > 0) sources.push('USGS 3DEP Terrain')
  if (brief) sources.push('Strike Brief Engine')

  const derivedTier = confidencePct > 0
    ? confidenceTier(confidencePct)
    : briefTierToInt((brief?.confidence_tier as string | null) ?? null)

  const payload: MipBriefPayload = {
    objective_id: objectiveId,
    brief_generated_at: new Date().toISOString(),
    confidence_tier: derivedTier,
    confidence_pct: confidencePct,
    summary: (sweep?.summary as string) ?? (brief?.synthesis as string) ?? 'Intelligence sweep pending — check back after next scheduled run.',
    signal_chips: signalChips,
    time_windows: timeWindows,
    map_pins: mapPins,
    sources,
    attribution: 'Powered by Meridian Arc',
  }

  return NextResponse.json(payload, { headers: partnerHeaders(partnerKey) })
}
