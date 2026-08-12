import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTier } from '@/lib/tiers'
import MeridianBeacon from '@/components/brand/MeridianBeacon'
import AskThreadClient from './AskThreadClient'

const ASK_LIMITS: Record<string, number> = {
  command: 20,
  accelerator: 10,
  explorer: 5,
}

export default async function AskPage({ searchParams }: { searchParams: { q?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [{ data: objectives }, { data: latestSweep }, { data: profile }, { count: monthlyUsed }] = await Promise.all([
    supabase.from('objectives').select('id, title, confidence, confidence_prev, category, status').eq('user_id', user!.id).eq('status', 'active'),
    supabase.from('sweeps').select('summary, raw_response, completed_at').eq('user_id', user!.id).eq('status', 'complete').not('raw_response', 'is', null).order('completed_at', { ascending: false }).limit(1).single(),
    supabase.from('profiles').select('tier, complimentary_expires_at, account_type').eq('id', user!.id).single(),
    supabase.from('ask_queries').select('id', { count: 'exact', head: true }).eq('user_id', user!.id).gte('created_at', monthStart.toISOString()),
  ])

  const objectiveList = objectives ?? []
  const openingMessage = `I know your ${objectiveList.length} active goal${objectiveList.length !== 1 ? 's' : ''} and everything from your last scan. What do you want to understand?`

  const tier = profile ? getEffectiveTier(profile) : 'explorer'
  const tierLimit = ASK_LIMITS[tier] ?? 5
  const used = monthlyUsed ?? 0
  const remaining = Math.max(tierLimit - used, 0)

  return (
    <div className="-m-6 p-6 min-h-[calc(100vh-3.5rem)]" style={{ backgroundColor: 'var(--navy)' }}>
      <div className="flex items-center gap-3 mb-4 max-w-2xl mx-auto">
        <Link href="/dashboard" aria-label="Back to dashboard" style={{ color: 'var(--ov-text-mid)' }}>
          <ChevronLeft size={20} />
        </Link>
        <MeridianBeacon size={22} variant="gold" animate={false} />
        <p style={{ fontFamily: "'EB Garamond', Georgia, serif", fontStyle: 'italic', fontSize: 16, color: '#fff' }}>
          Ask Meridian Arc
        </p>
        <Link href="/settings?tab=billing" className="ml-auto text-[11px] font-medium" style={{ color: 'var(--ov-text-dim)' }}>
          Ask Arc Credits: {remaining} / {tierLimit}
        </Link>
      </div>

      <AskThreadClient
        openingMessage={openingMessage}
        objectives={objectiveList}
        latestSweep={latestSweep ?? null}
        initialQuestion={searchParams.q}
      />
    </div>
  )
}
