import { createServiceClient } from '@/lib/supabase/server';
import { getAnthropicClient } from '@/lib/anthropic/client';
import { generateMovementWindows } from './movementPrediction';
import { getTerrainIntel } from './terrainIntelligence';

// --- Time window resolution (Mountain Time) ---

export function getTimeWindow(): '0600' | '1100' | '1700' {
  // MT = UTC-6 (MDT) or UTC-7 (MST). Using UTC-6 (summer/hunt season).
  const now = new Date();
  const mtHour = (now.getUTCHours() - 6 + 24) % 24;
  if (mtHour < 9) return '0600';
  if (mtHour < 14) return '1100';
  return '1700';
}

// --- Types ---

export type StrikeBriefContext = {
  objectiveId: string;
  objectiveTitle: string;
  domain: string;
  signalBrief: string;
  domainEvents: string;
  rawMacroEvents: object[];
  patternMatchYear: number | null;
  patternMatchScore: number | null;
  confidenceTier: string;
  agentHits: string[];
  geoProfile: { lat?: number; lng?: number } | null;
  domainProfile: object | null;
};

export type StrikeBriefRow = {
  id: string;
  objective_id: string;
  user_id: string;
  brief_date: string;
  time_window: string;
  domain: string;
  synthesis: string;
  lead_signal: string | null;
  go_no_go: string | null;
  condition_delta: string | null;
  pattern_match_year: number | null;
  confidence_tier: string | null;
  agent_hits: string[];
  movement_windows: Array<{ time: string; probability: number; reason: string; confidence_tier: string }> | null;
  terrain_intel: { bedding: string[]; feeding: string[]; corridors: string[]; elevation_range: { min: number; max: number } | null } | null;
  terrain_source: '3DEP' | 'user_described' | null;
  created_at: string;
};

// --- Context assembly ---

export async function buildStrikeBriefContext(
  objectiveId: string,
  userId: string
): Promise<StrikeBriefContext> {
  const supabase = createServiceClient();
  const today = new Date().toISOString().split('T')[0];

  // Objective record
  const { data: obj } = await supabase
    .from('objectives')
    .select('id, title, notes, goal_description, goal_context, category')
    .eq('id', objectiveId)
    .eq('user_id', userId)
    .single();

  // Domain profile
  const { data: profile } = await supabase
    .from('domain_profiles')
    .select('domain, signal_taxonomy, named_entities, geographic_scope')
    .eq('objective_id', objectiveId)
    .maybeSingle();

  const domain = profile?.domain ?? 'elk_hunt';
  const geoScope = profile?.geographic_scope as { lat?: number; lng?: number } | null;

  // Recent macro events (ELK_HUNT + UNIVERSAL, last 10)
  const { data: macroEvents } = await supabase
    .from('enterprise_macro_events')
    .select('event_date, event_name, description, direction, magnitude, source_series_id')
    .or("source_series_id.like.ELK_HUNT:%,source_series_id.like.UNIVERSAL:%")
    .order('event_date', { ascending: false })
    .limit(10);

  // Best pattern match
  const { data: pattern } = await supabase
    .from('pattern_matches')
    .select('comparison_year, similarity_score, pattern_label, historical_outcome')
    .eq('objective_id', objectiveId)
    .order('similarity_score', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Bound agents for this objective
  const { data: boundAgents } = await supabase
    .from('agent_objective_context')
    .select('agent_key')
    .eq('objective_id', objectiveId);

  const agentKeys = (boundAgents ?? []).map(r => r.agent_key as string);

  // Today's agent hits for bound agents
  let agentHits: string[] = [];
  if (agentKeys.length > 0) {
    const { data: runLogs } = await supabase
      .from('agent_run_log')
      .select('agent_key, ran_at')
      .in('agent_key', agentKeys)
      .eq('result', 'hit')
      .gte('ran_at', today);
    agentHits = (runLogs ?? []).map(r => r.agent_key as string);
  }

  // Format domain events summary
  const domainEvents = (macroEvents ?? [])
    .map(e => `[${e.event_date}] ${e.event_name}: ${e.description ?? ''} (${e.direction ?? 'neutral'}, magnitude ${e.magnitude ?? '?'})`)
    .join('\n') || 'No recent domain events';

  // Signal brief from domain profile taxonomy
  const taxonomy = profile?.signal_taxonomy as Record<string, unknown> | null;
  const signalBrief = taxonomy
    ? JSON.stringify(taxonomy, null, 2)
    : 'No signal taxonomy available — domain profile not yet built for this objective.';

  // Confidence tier from pattern match
  const confidenceTier = pattern
    ? pattern.similarity_score >= 80 ? 'T1'
    : pattern.similarity_score >= 60 ? 'T2'
    : pattern.similarity_score >= 40 ? 'T3'
    : 'T4'
    : 'T4';

  return {
    objectiveId,
    objectiveTitle: obj?.title ?? 'Unknown objective',
    domain,
    signalBrief,
    domainEvents,
    rawMacroEvents: (macroEvents ?? []) as object[],
    patternMatchYear: pattern?.comparison_year ?? null,
    patternMatchScore: pattern ? Number(pattern.similarity_score) : null,
    confidenceTier,
    agentHits,
    geoProfile: geoScope ?? null,
    domainProfile: profile ?? null,
  };
}

// --- Prompt builder ---

export function buildStrikeBriefPrompt(context: StrikeBriefContext, timeWindow: string): string {
  const windowInstructions: Record<string, string> = {
    '0600': `MORNING BRIEF — 0600. Synthesize for a hunter leaving camp within 90 minutes.
      Lead with: where to be and why. Include thermal direction, wind, water source proximity given current drought.
      End with one sentence: the single most important thing to act on this morning.`,
    '1100': `MIDDAY CHECK — 1100. Synthesize condition delta since morning.
      Has anything changed that alters the plan? Go/No-Go on afternoon move.
      If conditions unchanged, say so in one sentence and stand down. Do not generate noise.`,
    '1700': `EVENING BRIEF — 1700. Synthesize afternoon thermal shift and feeding corridor probability.
      Seed tomorrow's morning plan from today's conditions.
      One paragraph. End with tomorrow's first action.`,
  };

  return `You are Meridian's Strike Brief engine for the outdoor / hunting domain.

TIME WINDOW: ${windowInstructions[timeWindow] ?? windowInstructions['0600']}

OBJECTIVE: ${context.objectiveTitle}
DOMAIN: ${context.domain}
PATTERN MATCH: ${context.patternMatchYear ? `Current conditions match ${context.patternMatchYear} at ${context.patternMatchScore}% similarity` : 'No pattern match'}
CONFIDENCE TIER: ${context.confidenceTier}

SIGNAL BRIEF (from sub-agents):
${context.signalBrief}

DOMAIN EVENTS (from enrichment engine):
${context.domainEvents}

AGENT HITS TODAY:
${context.agentHits.length > 0 ? context.agentHits.join('\n') : 'No new agent hits today'}

INTELLIGENCE INTEGRITY STANDARD:
- T1: Government/agency structured data — state as fact
- T2: Verified field observation — state as reported
- T3: Reported/anecdotal — qualify explicitly
- T4: Modeled/inferred — flag as projection

RULES:
- Never state as fact what has not been confirmed by a named, timestamped, verifiable source
- If objective notes contain "condition-gated" do NOT generate date urgency
- One paragraph maximum per time window
- Tell the user something they could not have known without Meridian
- If there is nothing new to say at 1100, say so in one sentence. Do not pad.

OUTPUT FORMAT (JSON only, no markdown):
{
  "synthesis": "one paragraph brief",
  "lead_signal": "single most actionable signal in one sentence",
  "go_no_go": "GO | NO_GO | CONDITIONAL | MONITOR",
  "condition_delta": "what changed since last brief, or null if first brief of day",
  "confidence_tier": "T1 | T2 | T3 | T4"
}`;
}

// --- Main generator ---

export async function generateStrikeBrief(
  objectiveId: string,
  userId: string
): Promise<StrikeBriefRow> {
  const supabase = createServiceClient();
  const timeWindow = getTimeWindow();
  const today = new Date().toISOString().split('T')[0];

  // Return cached brief if one exists for this window today
  const { data: existing } = await supabase
    .from('strike_briefs')
    .select('*')
    .eq('objective_id', objectiveId)
    .eq('brief_date', today)
    .eq('time_window', timeWindow)
    .maybeSingle();

  if (existing) return existing as StrikeBriefRow;

  // Build context
  const context = await buildStrikeBriefContext(objectiveId, userId);
  const prompt = buildStrikeBriefPrompt(context, timeWindow);

  // Call Sonnet
  const anthropic = getAnthropicClient();
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('[StrikeBrief] Failed to parse Sonnet response as JSON');

  let parsed: {
    synthesis?: string;
    lead_signal?: string;
    go_no_go?: string;
    condition_delta?: string;
    confidence_tier?: string;
  } = {};
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error('[StrikeBrief] JSON parse failed');
  }

  const { data: brief, error } = await supabase
    .from('strike_briefs')
    .insert({
      objective_id: objectiveId,
      user_id: userId,
      brief_date: today,
      time_window: timeWindow,
      domain: context.domain,
      synthesis: parsed.synthesis ?? raw,
      lead_signal: parsed.lead_signal ?? null,
      go_no_go: parsed.go_no_go ?? null,
      condition_delta: parsed.condition_delta ?? null,
      pattern_match_year: context.patternMatchYear,
      confidence_tier: parsed.confidence_tier ?? context.confidenceTier,
      agent_hits: context.agentHits,
    })
    .select()
    .single();

  if (error || !brief) throw new Error(`[StrikeBrief] DB write failed: ${error?.message}`);

  const briefId = (brief as { id: string }).id;

  // FF-076: Movement windows (Haiku, non-fatal)
  try {
    const movementWindows = await generateMovementWindows(
      context.domain,
      context.patternMatchYear,
      context.signalBrief,
      context.rawMacroEvents
    );
    await supabase.from('strike_briefs').update({ movement_windows: movementWindows }).eq('id', briefId);
    (brief as Record<string, unknown>).movement_windows = movementWindows;
  } catch (err) {
    console.error('[StrikeBrief] Movement windows failed:', err);
  }

  // FF-076: Terrain intelligence (Sonnet, non-fatal, only when lat/lng available)
  try {
    if (context.geoProfile?.lat !== undefined && context.geoProfile?.lng !== undefined) {
      const terrainResult = await getTerrainIntel(
        context.geoProfile.lat,
        context.geoProfile.lng,
        context.domain,
        context.domainProfile ?? {}
      );
      await supabase.from('strike_briefs').update({
        terrain_intel: terrainResult.intel,
        terrain_source: terrainResult.source,
      }).eq('id', briefId);
      (brief as Record<string, unknown>).terrain_intel = terrainResult.intel;
      (brief as Record<string, unknown>).terrain_source = terrainResult.source;
    }
  } catch (err) {
    console.error('[StrikeBrief] Terrain intel failed:', err);
  }

  return brief as StrikeBriefRow;
}
