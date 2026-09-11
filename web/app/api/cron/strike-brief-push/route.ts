import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { generateStrikeBrief } from '@/lib/strikeBrief/strikeBriefGenerator';

export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Load all active elk_hunt objectives (domain = elk_hunt, status = active)
  const { data: profiles } = await supabase
    .from('domain_profiles')
    .select('objective_id, domain')
    .eq('domain', 'elk_hunt');

  if (!profiles || profiles.length === 0) {
    console.log('[StrikeBriefPush] No elk_hunt domain profiles found');
    return NextResponse.json({ generated: 0 });
  }

  const objectiveIds = profiles.map(p => p.objective_id as string);

  // Load the objectives to get user_id
  const { data: objectives } = await supabase
    .from('objectives')
    .select('id, user_id, status')
    .in('id', objectiveIds)
    .eq('status', 'active');

  if (!objectives || objectives.length === 0) {
    console.log('[StrikeBriefPush] No active elk_hunt objectives found');
    return NextResponse.json({ generated: 0 });
  }

  const results: { objectiveId: string; result: 'generated' | 'error'; error?: string }[] = [];

  for (const obj of objectives) {
    try {
      await generateStrikeBrief(obj.id as string, obj.user_id as string);
      results.push({ objectiveId: obj.id as string, result: 'generated' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[StrikeBriefPush] Failed for ${obj.id}:`, msg);
      results.push({ objectiveId: obj.id as string, result: 'error', error: msg });
    }
  }

  const generated = results.filter(r => r.result === 'generated').length;
  const errors = results.filter(r => r.result === 'error').length;

  console.log(`[StrikeBriefPush] ${results.length} objectives processed · ${generated} generated · ${errors} errors`);

  return NextResponse.json({ processed: results.length, generated, errors, results });
}
