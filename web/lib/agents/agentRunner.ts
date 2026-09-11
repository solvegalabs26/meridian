import { createServiceClient } from '@/lib/supabase/server';
import { buildUrl, evaluateThreshold, writeEvent, logRun } from './agentHelpers';

export type AgentResult = {
  agentKey: string;
  result: 'hit' | 'miss' | 'error' | 'skip';
  eventId?: string;
  durationMs: number;
  thresholdValueObserved?: number;
  errorMessage?: string;
};

export async function runAgent(
  agentKey: string,
  geoContext: {
    state?: string;
    county?: string;
    domain?: string;
    objectiveId?: string;
  }
): Promise<AgentResult> {
  const start = Date.now();
  const supabase = createServiceClient();

  // 1. Load agent config
  const { data: agent, error } = await supabase
    .from('agent_configs')
    .select('*')
    .eq('agent_key', agentKey)
    .eq('is_active', true)
    .single();

  if (error || !agent) {
    return {
      agentKey,
      result: 'error',
      durationMs: Date.now() - start,
      errorMessage: 'Agent config not found',
    };
  }

  // 2. Check cadence — skip if last hit was within cadence window
  const { data: lastRun } = await supabase
    .from('agent_run_log')
    .select('ran_at')
    .eq('agent_key', agentKey)
    .eq('result', 'hit')
    .order('ran_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastRun) {
    const minutesSinceLastRun = (Date.now() - new Date(lastRun.ran_at as string).getTime()) / 60000;
    if (minutesSinceLastRun < agent.cadence_minutes) {
      await logRun(supabase, agentKey, 'skip', Date.now() - start, undefined, undefined, geoContext);
      return { agentKey, result: 'skip', durationMs: Date.now() - start };
    }
  }

  // 3. Build URL
  const url = buildUrl(agent.source_url_template as string, geoContext);

  try {
    // 4. Fetch
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const contentType = response.headers.get('content-type') ?? '';
    const body = contentType.includes('json') ? await response.json() : await response.text();

    // 5. Threshold evaluation
    const { crossed, observedValue } = evaluateThreshold(
      body,
      agent.threshold_type as string,
      agent.threshold_value as number | null,
      agent.threshold_keywords as string[] | null
    );

    if (!crossed) {
      await logRun(supabase, agentKey, 'miss', Date.now() - start, undefined, observedValue, geoContext);
      return { agentKey, result: 'miss', durationMs: Date.now() - start, thresholdValueObserved: observedValue };
    }

    // 6. Write event to enterprise_macro_events
    const eventId = await writeEvent(supabase, agent as Parameters<typeof writeEvent>[1], geoContext, observedValue, url);

    // 7. Log run
    await logRun(supabase, agentKey, 'hit', Date.now() - start, eventId, observedValue, geoContext);

    return { agentKey, result: 'hit', eventId, durationMs: Date.now() - start, thresholdValueObserved: observedValue };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    await logRun(supabase, agentKey, 'error', Date.now() - start, undefined, undefined, geoContext, msg);
    return { agentKey, result: 'error', durationMs: Date.now() - start, errorMessage: msg };
  }
}
