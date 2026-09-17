import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import StrikeBriefClient from '@/components/strike/StrikeBriefClient'

export const revalidate = 1800

export default async function StrikePage({ params }: { params: { id: string } }) {
  const supabase = createServiceClient()

  const { data: objective } = await supabase
    .from('objective_profiles')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (!objective) notFound()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  let brief: Record<string, unknown> = {}
  try {
    const res = await fetch(
      `${appUrl}/api/mip/brief?objective_id=${params.id}&partner_key=strike`,
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
