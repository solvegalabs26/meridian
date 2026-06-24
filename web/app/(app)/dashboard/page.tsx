import { createClient } from '@/lib/supabase/server'
import MeridianBeacon from '@/components/brand/MeridianBeacon'
import ConfidenceMeter from '@/components/objectives/ConfidenceMeter'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, { data: objectives }, { data: lastSweep }] = await Promise.all([
    supabase.from('profiles').select('full_name, sweep_count, tier').eq('id', user!.id).single(),
    supabase.from('objectives').select('id, title, confidence, status').eq('user_id', user!.id).eq('status', 'active').order('sort_order'),
    supabase.from('sweeps').select('*').eq('user_id', user!.id).eq('status', 'complete').order('completed_at', { ascending: false }).limit(1).single(),
  ])

  const hasSweep = !!lastSweep
  const sweepData = lastSweep?.raw_response as {
    sweep_summary?: string
    top_priority_action?: string
    objectives?: Array<{
      obj_id: string
      opportunities?: string[]
      risks?: string[]
      changed_since_last_sweep?: string
      actions?: string[]
    }>
    cross_objective_dependencies?: Array<{
      from_obj: string
      to_obj: string
      description: string
      urgency: string
    }>
  } | null

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-medium text-[var(--text)]">
          Good to see you{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}.
        </h1>
        <p className="text-[14px] text-[var(--text3)] mt-1">
          Mission Control — your Persistent Objective State at a glance.
        </p>
      </div>

      {/* Confidence strip */}
      {objectives && objectives.length > 0 && hasSweep && (
        <div className="flex gap-3 overflow-x-auto pb-1 mb-5 scrollbar-hide">
          {objectives.map(obj => (
            <Link
              key={obj.id}
              href={`/objectives/${obj.id}`}
              className="flex-shrink-0 bg-white rounded-xl border border-[var(--border)] px-4 py-3 min-w-[160px] hover:shadow-sm hover:border-[var(--blue-mid)] transition-all"
            >
              <p className="text-[11px] text-[var(--text3)] mb-2 truncate">{obj.title}</p>
              <ConfidenceMeter score={obj.confidence} size="sm" />
            </Link>
          ))}
        </div>
      )}

      {!hasSweep ? (
        /* Empty state */
        <div className="bg-white rounded-2xl border border-[var(--border)] p-12 text-center">
          <div className="flex justify-center mb-5">
            <MeridianBeacon size={64} variant="gold" animate={true} />
          </div>
          <h2 className="text-[18px] font-medium text-[var(--text)] mb-2">
            Run your first sweep to see Mission Control
          </h2>
          <p className="text-[14px] text-[var(--text2)] max-w-md mx-auto mb-6">
            Meridian will scan your objectives against current signals, synthesize confidence scores,
            and surface the actions that matter most today.
          </p>
          <p className="text-[12px] text-[var(--text3)]">Click <strong>Run Sweep</strong> in the top right to begin.</p>

          {objectives && objectives.length > 0 && (
            <div className="mt-8 pt-6 border-t border-[var(--border)]">
              <p className="text-[12px] font-medium text-[var(--text3)] uppercase tracking-wider mb-3">
                Active objectives ({objectives.length})
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {objectives.map((obj) => (
                  <Link key={obj.id} href={`/objectives/${obj.id}`}
                    className="px-3 py-1.5 rounded-lg bg-[var(--gray-lt)] text-[12.5px] text-[var(--text2)] hover:bg-[var(--border)] transition-colors">
                    {obj.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Mission Control — sweep results */
        <div className="space-y-4">
          {/* Cross-dep alert */}
          {sweepData?.cross_objective_dependencies && sweepData.cross_objective_dependencies.length > 0 && (
            <div className="bg-[var(--amber-lt)] border border-[var(--amber-brand)]/30 rounded-xl p-4">
              <p className="text-[11px] font-semibold text-[var(--amber-brand)] uppercase tracking-wider mb-1">
                ⇄ Cross-objective connection detected
              </p>
              {sweepData.cross_objective_dependencies.map((dep, i) => (
                <p key={i} className="text-[13px] text-[var(--text2)]">
                  <strong>{dep.from_obj}</strong> → <strong>{dep.to_obj}</strong>: {dep.description}
                </p>
              ))}
            </div>
          )}

          {/* Sweep summary */}
          {sweepData?.sweep_summary && (
            <div className="bg-white rounded-xl border border-[var(--border)] p-5">
              <p className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wider mb-2">Sweep summary</p>
              <p className="text-[14px] text-[var(--text2)] leading-relaxed">{sweepData.sweep_summary}</p>
            </div>
          )}

          {/* Four quadrants */}
          <div className="grid grid-cols-2 gap-4">
            {/* Opportunities */}
            <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
              <div className="px-4 py-3 bg-[var(--green-lt)] border-b border-[var(--green)]/20">
                <p className="text-[11px] font-semibold text-[var(--green)] uppercase tracking-wider">Opportunities</p>
              </div>
              <ul className="p-4 space-y-2">
                {sweepData?.objectives?.flatMap(o => o.opportunities ?? []).slice(0, 5).map((item, i) => (
                  <li key={i} className="text-[13px] text-[var(--text2)] flex gap-2">
                    <span className="text-[var(--green)] mt-0.5 flex-shrink-0">↑</span>{item}
                  </li>
                )) ?? <li className="text-[12px] text-[var(--text3)]">Run a sweep to see opportunities</li>}
              </ul>
            </div>

            {/* Risks */}
            <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
              <div className="px-4 py-3 bg-[var(--red-lt)] border-b border-[var(--red)]/20">
                <p className="text-[11px] font-semibold text-[var(--red)] uppercase tracking-wider">Risks</p>
              </div>
              <ul className="p-4 space-y-2">
                {sweepData?.objectives?.flatMap(o => o.risks ?? []).slice(0, 5).map((item, i) => (
                  <li key={i} className="text-[13px] text-[var(--text2)] flex gap-2">
                    <span className="text-[var(--red)] mt-0.5 flex-shrink-0">↓</span>{item}
                  </li>
                )) ?? <li className="text-[12px] text-[var(--text3)]">Run a sweep to see risks</li>}
              </ul>
            </div>

            {/* Changed since last sweep */}
            <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
              <div className="px-4 py-3 bg-[var(--amber-lt)] border-b border-[var(--amber-brand)]/20">
                <p className="text-[11px] font-semibold text-[var(--amber-brand)] uppercase tracking-wider">Changed since last sweep</p>
              </div>
              <ul className="p-4 space-y-2">
                {sweepData?.objectives?.filter(o => o.changed_since_last_sweep).map((o, i) => (
                  <li key={i} className="text-[13px] text-[var(--text2)]">
                    <span className="font-medium">{o.obj_id}:</span> {o.changed_since_last_sweep}
                  </li>
                )) ?? <li className="text-[12px] text-[var(--text3)]">No changes detected</li>}
              </ul>
            </div>

            {/* Do next */}
            <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
              <div className="px-4 py-3 bg-[#E6F1FB] border-b border-[var(--blue)]/20">
                <p className="text-[11px] font-semibold text-[var(--blue)] uppercase tracking-wider">Do next</p>
              </div>
              <ul className="p-4 space-y-2">
                {sweepData?.top_priority_action && (
                  <li className="text-[13px] text-[var(--text)] font-medium flex gap-2">
                    <span className="text-[var(--blue)] flex-shrink-0">→</span>{sweepData.top_priority_action}
                  </li>
                )}
                {sweepData?.objectives?.flatMap(o => o.actions ?? []).slice(0, 3).map((item, i) => (
                  <li key={i} className="text-[13px] text-[var(--text2)] flex gap-2">
                    <span className="text-[var(--blue)] flex-shrink-0">·</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Status tiles */}
      <div className="grid grid-cols-3 gap-4 mt-4">
        <div className="bg-white rounded-xl border border-[var(--border)] p-4">
          <p className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wider">Active objectives</p>
          <p className="text-[28px] font-light text-[var(--text)] mt-1">{objectives?.length ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-[var(--border)] p-4">
          <p className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wider">Sweeps run</p>
          <p className="text-[28px] font-light text-[var(--text)] mt-1">{profile?.sweep_count ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-[var(--border)] p-4">
          <p className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wider">Tier</p>
          <p className="text-[28px] font-light text-[var(--text)] mt-1 capitalize">{profile?.tier ?? 'trial'}</p>
        </div>
      </div>
    </div>
  )
}
