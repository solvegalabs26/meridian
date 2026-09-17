import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import StrikeBriefClient from '@/components/strike/StrikeBriefClient'

export const dynamic = 'force-dynamic'

export default async function StrikePage({ params }: { params: { id: string } }) {
  const supabase = createServiceClient()

  // Try profile PK first, fall back to arc objective_id FK (handles both URL shapes)
  let { data: objective } = await supabase
    .from('objective_profiles')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (!objective) {
    const { data: byArcId } = await supabase
      .from('objective_profiles')
      .select('*')
      .eq('objective_id', params.id)
      .maybeSingle()
    objective = byArcId
  }

  console.log('[strike/[id]] params.id:', params.id, 'objective id:', (objective as Record<string, unknown> | null)?.id ?? null)
  if (!objective) notFound()

  let brief: Record<string, unknown> = {}
  try {
    const briefUrl = `/api/mip/brief?objective_id=${params.id}&partner_key=strike`
    console.log('[strike/[id]] briefUrl:', briefUrl)
    const res = await fetch(briefUrl, { cache: 'no-store' })
    if (res.ok) {
      brief = await res.json()
    } else {
      console.log('[strike/[id]] brief fetch failed:', res.status, await res.text().catch(() => ''))
    }
  } catch (e) {
    console.log('[strike/[id]] brief fetch error:', e)
  }
  console.log('[strike/[id]] brief time_windows:', (brief.time_windows as unknown[] | null)?.length ?? 'null/missing')

  return (
    <StrikeBriefClient
      brief={brief}
      objective={objective as Parameters<typeof StrikeBriefClient>[0]['objective']}
    />
  )
}
