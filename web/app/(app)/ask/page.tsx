import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import MeridianBeacon from '@/components/brand/MeridianBeacon'
import AskThreadClient from './AskThreadClient'

export default async function AskPage({ searchParams }: { searchParams: { q?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: objectives }, { data: latestSweep }] = await Promise.all([
    supabase.from('objectives').select('id, title, confidence, confidence_prev, category, status').eq('user_id', user!.id).eq('status', 'active'),
    supabase.from('sweeps').select('summary, raw_response, completed_at').eq('user_id', user!.id).eq('status', 'complete').not('raw_response', 'is', null).order('completed_at', { ascending: false }).limit(1).single(),
  ])

  const objectiveList = objectives ?? []
  const openingMessage = `I know your ${objectiveList.length} active goal${objectiveList.length !== 1 ? 's' : ''} and everything from your last scan. What do you want to understand?`

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
