import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, sweep_count, tier')
    .eq('id', user!.id)
    .single()

  const { data: objectives } = await supabase
    .from('objectives')
    .select('id, title, confidence, status')
    .eq('user_id', user!.id)
    .eq('status', 'active')
    .order('sort_order')

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

      {/* Empty state — no sweep yet */}
      <div className="bg-white rounded-2xl border border-[var(--border)] p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mx-auto mb-5">
          <div className="w-5 h-5 rounded-full bg-gold/60" />
        </div>
        <h2 className="text-[18px] font-medium text-[var(--text)] mb-2">
          Run your first sweep to see Mission Control
        </h2>
        <p className="text-[14px] text-[var(--text2)] max-w-md mx-auto mb-6">
          Meridian will scan your objectives against current signals, synthesize confidence scores,
          and surface the actions that matter most today.
        </p>
        <button
          disabled
          className="px-6 py-3 rounded-xl bg-navy text-white text-[14px] font-medium opacity-40 cursor-not-allowed"
          title="Sweep engine available in Phase 3"
        >
          Run Sweep — Available in Phase 3
        </button>

        {/* Objectives preview */}
        {objectives && objectives.length > 0 && (
          <div className="mt-8 pt-6 border-t border-[var(--border)]">
            <p className="text-[12px] font-medium text-[var(--text3)] uppercase tracking-wider mb-3">
              Active objectives ({objectives.length})
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {objectives.map((obj) => (
                <div key={obj.id} className="px-3 py-1.5 rounded-lg bg-[var(--gray-lt)] text-[12.5px] text-[var(--text2)]">
                  {obj.title}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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
