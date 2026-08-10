// lib/sweep/buildCoherencePackage.ts
// Signal Coherence Layer — assembles per-objective watch source context and
// formats it for injection into Engine 1 (keyword targeting) and Engine 3
// (Sonnet synthesis) sweep prompts.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface WatchSourceEntry {
  url_resolved: string
  url_provided: string
  watch_type: string
  target_signal: string | null
  label: string | null
}

export interface CoherencePackage {
  objectiveId: string
  title: string
  outcome: string | null
  success_condition: string | null
  current_confidence: number | null
  category: string | null
  watchSources: WatchSourceEntry[]
  openActions: string[]
  completedActions: { description: string; actionDate: string }[]
  predictions: { statement: string; confidencePct: number; horizonDate: string | null; status: string }[]
  episodes: { episodeNumber: number; narrative: string | null; createdAt: string }[]
}

export async function buildCoherencePackage(
  supabase: SupabaseClient,
  objectiveId: string
): Promise<CoherencePackage | null> {
  // Fetch objective + watch sources in parallel
  const [objResult, watchResult] = await Promise.all([
    supabase
      .from('objectives')
      .select('title, outcome, success_condition, confidence, category')
      .eq('id', objectiveId)
      .single(),
    supabase
      .from('watch_sources')
      .select('url_resolved, url_provided, watch_type, target_signal, label')
      .eq('objective_id', objectiveId)
      .eq('is_active', true)
      .not('url_resolved', 'is', null),
  ])

  console.log(`[coherence] objective=${objectiveId} watch_sources_count=${watchResult.data?.length ?? 0} error=${watchResult.error?.message ?? 'none'}`)

  const watchSources: WatchSourceEntry[] = (watchResult.data ?? []) as WatchSourceEntry[]

  // No watch sources → no coherence package needed
  if (watchSources.length === 0) return null

  const obj = objResult.data
  if (!obj) return null

  // Fetch actions, predictions, episodes in parallel
  const [openActionsResult, doneActionsResult, predictionsResult, episodesResult] = await Promise.all([
    supabase
      .from('objective_actions')
      .select('description')
      .eq('objective_id', objectiveId)
      .eq('status', 'open')
      .limit(5),
    supabase
      .from('objective_actions')
      .select('description, action_date')
      .eq('objective_id', objectiveId)
      .eq('status', 'done')
      .order('action_date', { ascending: false })
      .limit(5),
    supabase
      .from('predictions')
      .select('statement, confidence_pct, horizon_date, status')
      .eq('objective_id', objectiveId)
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('objective_episodes')
      .select('episode_number, narrative, created_at')
      .eq('objective_id', objectiveId)
      .order('episode_number', { ascending: false })
      .limit(3),
  ])

  return {
    objectiveId,
    title: (obj.title as string) ?? '',
    outcome: (obj.outcome as string | null) ?? null,
    success_condition: (obj.success_condition as string | null) ?? null,
    current_confidence: (obj.confidence as number | null) ?? null,
    category: (obj.category as string | null) ?? null,
    watchSources,
    openActions: (openActionsResult.data ?? []).map(a => a.description as string).filter(Boolean),
    completedActions: (doneActionsResult.data ?? []).map(a => ({
      description: a.description as string,
      actionDate: a.action_date as string,
    })),
    predictions: (predictionsResult.data ?? []).map(p => ({
      statement: p.statement as string,
      confidencePct: p.confidence_pct as number,
      horizonDate: (p.horizon_date as string | null) ?? null,
      status: p.status as string,
    })),
    episodes: (episodesResult.data ?? []).map(e => ({
      episodeNumber: e.episode_number as number,
      narrative: (e.narrative as string | null) ?? null,
      createdAt: e.created_at as string,
    })),
  }
}

export function formatCoherencePackageForPrompt(pkg: CoherencePackage): string {
  const lines: string[] = []

  lines.push('=== SIGNAL COHERENCE PACKAGE ===')
  lines.push(`OBJECTIVE: ${pkg.title}`)
  if (pkg.success_condition) lines.push(`SUCCESS CONDITION: ${pkg.success_condition}`)
  if (pkg.current_confidence !== null) lines.push(`CURRENT CONFIDENCE: ${pkg.current_confidence}%`)
  if (pkg.outcome) lines.push(`TARGET SIGNAL: ${pkg.outcome}`)
  lines.push('')

  lines.push('WATCH SOURCES (primary targeting — check these first):')
  for (const ws of pkg.watchSources) {
    const label = ws.label ?? ws.url_provided ?? ws.url_resolved
    lines.push(`  - [${ws.watch_type}] ${label}: ${ws.url_resolved}`)
    if (ws.target_signal) lines.push(`    Looking for: ${ws.target_signal}`)
  }
  lines.push('')

  if (pkg.predictions.length > 0) {
    lines.push('PREDICTION TRAJECTORY:')
    for (const p of pkg.predictions) {
      const horizon = p.horizonDate ? ` | Horizon: ${p.horizonDate}` : ''
      lines.push(`  - ${p.statement} | Confidence: ${p.confidencePct}%${horizon} | Status: ${p.status}`)
    }
    lines.push('')
  }

  if (pkg.openActions.length > 0) {
    lines.push('OPEN ACTIONS:')
    for (const a of pkg.openActions) lines.push(`  - ${a}`)
    lines.push('')
  }

  if (pkg.completedActions.length > 0) {
    lines.push('COMPLETED ACTIONS (recent):')
    for (const a of pkg.completedActions) {
      lines.push(`  - ${a.description} (completed ${a.actionDate})`)
    }
    lines.push('')
  }

  if (pkg.episodes.length > 0) {
    lines.push('EPISODE HISTORY (recent):')
    for (const e of pkg.episodes) {
      const summary = e.narrative ? e.narrative.slice(0, 300) : 'No narrative'
      lines.push(`  Episode ${e.episodeNumber} (${e.createdAt.split('T')[0]}): ${summary}`)
    }
    lines.push('')
  }

  lines.push('=== END COHERENCE PACKAGE ===')
  return lines.join('\n')
}
