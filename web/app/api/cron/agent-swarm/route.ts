import { NextResponse } from 'next/server';
import { runAgent } from '@/lib/agents/agentRunner';
import { createServiceClient } from '@/lib/supabase/server';

export const maxDuration = 300;

export async function GET(request: Request) {
  // const authHeader = request.headers.get('authorization');
  // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  const supabase = createServiceClient();

  const { data: agents } = await supabase
    .from('agent_configs')
    .select('agent_key, vertical, domain, geo_scope')
    .eq('is_active', true);

  if (!agents || agents.length === 0) {
    return NextResponse.json({ ran: 0 });
  }

  // Sequential to avoid rate limiting on government APIs
  const results = [];
  for (const agent of agents) {
    const geoContext = {
      state: (agent.geo_scope as string[] | null)?.[0] ?? 'UT',
      county: (agent.geo_scope as string[] | null)?.[1] ?? '',
      domain: agent.domain as string,
    };
    const result = await runAgent(agent.agent_key as string, geoContext);
    results.push(result);
  }

  const hits = results.filter(r => r.result === 'hit').length;
  const errors = results.filter(r => r.result === 'error').length;

  console.log(`[AgentSwarm] ${results.length} agents ran · ${hits} hits · ${errors} errors`);

  return NextResponse.json({ ran: results.length, hits, errors, results });
}
