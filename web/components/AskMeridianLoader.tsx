// components/AskMeridianLoader.tsx
// FF-017 — Server component wrapper: prefetches monthly usage so the
// client component renders with correct state on first paint (no flash).
//
// Drop this import into your dashboard page (app/(dashboard)/page.tsx or similar)
// and render <AskMeridianLoader /> below the objectives list.
//
// Example dashboard page usage:
//   import AskMeridianLoader from '@/components/AskMeridianLoader'
//   ...
//   <ObjectivesList />
//   <AskMeridianLoader />

import AskMeridian from '@/components/AskMeridian'
import { createClient } from '@/lib/supabase/server'

const ASK_LIMITS: Record<string, number> = {
  command: 10,
  accelerator: 3,
  explorer: 1,
  trial: 0,
}

function getEffectiveTier(profile: {
  pricing_tier: string | null
  tier: string | null
  complimentary_expires_at: string | null
}): string {
  if (
    profile.complimentary_expires_at &&
    new Date(profile.complimentary_expires_at) > new Date()
  ) {
    return 'explorer'
  }
  const raw = profile.pricing_tier ?? profile.tier ?? 'trial'
  if (raw.includes('explorer')) return 'explorer'
  if (raw.includes('accelerator')) return 'accelerator'
  if (raw.includes('command')) return 'command'
  return raw
}

export default async function AskMeridianLoader() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Unauthenticated — don't render the component
  if (!user) return null

  // Profile for tier
  const { data: profile } = await supabase
    .from('profiles')
    .select('tier, pricing_tier, complimentary_expires_at, ask_credits')
    .eq('id', user.id)
    .single()

  const effectiveTier = getEffectiveTier(
    profile ?? { pricing_tier: null, tier: null, complimentary_expires_at: null }
  )
  const limit = ASK_LIMITS[effectiveTier] ?? 0

  // Don't render at all for trial users (no access)
  if (limit === 0) return null

  // Monthly usage count
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const { count } = await supabase
    .from('ask_queries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', monthStart.toISOString())

  return (
    <AskMeridian
      initialUsage={{
        used: count ?? 0,
        limit,
        tier: effectiveTier,
        askCredits: profile?.ask_credits ?? 0,
      }}
    />
  )
}
