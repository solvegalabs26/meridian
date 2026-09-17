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

  // Prefer arc objective_id for the brief API (what strike_briefs is keyed by).
  // Fall back to profile PK so the dispatch can resolve it.
  const obj = objective as Record<string, unknown>
  const briefObjectiveId = (obj.objective_id as string | null) ?? (obj.id as string)

  // VERCEL_URL is auto-set on all Vercel deployments (preview + production).
  // NEXT_PUBLIC_APP_URL overrides when explicitly set (local dev or custom domain).
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  let brief: Record<string, unknown> = {}
  try {
    const briefUrl = `${appUrl}/api/mip/brief?objective_id=${briefObjectiveId}&partner_key=strike`
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
