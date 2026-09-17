import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import StrikeBriefClient from '@/components/strike/StrikeBriefClient'

export const revalidate = 1800

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

  // Use profile PK for the brief API — dispatch resolves arc ID internally
  const profileId = (objective as Record<string, unknown>).id as string
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  let brief: Record<string, unknown> = {}
  try {
    const res = await fetch(
      `${appUrl}/api/mip/brief?objective_id=${profileId}&partner_key=strike`,
      { next: { revalidate: 1800 } }
    )
    if (res.ok) brief = await res.json()
  } catch {}

  return (
    <StrikeBriefClient
      brief={brief}
      objective={objective as Parameters<typeof StrikeBriefClient>[0]['objective']}
    />
  )
}
