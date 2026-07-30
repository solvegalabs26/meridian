export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  if (user.app_metadata?.enterprise_only === true) {
    return <>{children}</>
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarded_at, account_type, last_sweep_at, tutorial_views_count')
    .eq('id', user.id)
    .single()
  if (!profile?.onboarded_at) redirect('/onboarding/sweep')

  // Last sweep time for display in TopBar — exclude user_action recomputes
  // (status=complete but raw_response=null) so they don't show as "Just now"
  const { data: lastSweep } = await supabase
    .from('sweeps')
    .select('completed_at')
    .eq('user_id', user.id)
    .eq('status', 'complete')
    .not('raw_response', 'is', null)
    .neq('trigger_type', 'user_action')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single()

  // Compute next_sweep_at so SweepButton can show rate-limit state on load
  const RATE_LIMIT_MS = 23 * 60 * 60 * 1000
  const RATE_LIMITED_TYPES = new Set(['alpha_personal', 'alpha_business', 'beta', 'personal'])
  let nextSweepAt: string | null = null
  if (RATE_LIMITED_TYPES.has(profile?.account_type ?? 'personal') && profile?.last_sweep_at) {
    const next = new Date(new Date(profile.last_sweep_at).getTime() + RATE_LIMIT_MS)
    if (next > new Date()) nextSweepAt = next.toISOString()
  }

  return (
    <AppShell
      userEmail={user.email}
      lastSweepAt={lastSweep?.completed_at ?? null}
      nextSweepAt={nextSweepAt}
      tutorialViewsCount={profile?.tutorial_views_count ?? 0}
    >
      {children}
    </AppShell>
  )
}
