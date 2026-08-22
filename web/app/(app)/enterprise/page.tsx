import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EnterprisePortalClient from './EnterprisePortalClient'

export const metadata = { title: 'Enterprise Portal — Meridian Arc' }

export default async function EnterprisePage({
  searchParams,
}: {
  searchParams?: { iid?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const paramIid = searchParams?.iid as string | undefined

  let institutionId: string | null = null

  if (paramIid) {
    const { data: membership } = await supabase
      .from('enterprise_members')
      .select('institution_id')
      .eq('institution_id', paramIid)
      .eq('user_id', user.id)
      .maybeSingle()
    institutionId = membership?.institution_id ?? null
  }

  if (!institutionId) {
    const { data: firstMember } = await supabase
      .from('enterprise_members')
      .select('institution_id')
      .eq('user_id', user.id)
      .order('invited_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    institutionId = firstMember?.institution_id ?? null
  }

  const resolvedInstitutionId = institutionId ?? 'a1b2c3d4-0000-0000-0000-000000000001'

  let institutionName = 'Unknown Institution'
  let logoUrl: string | null = null

  const { data: inst } = await supabase
    .from('enterprise_institutions')
    .select('name, logo_url')
    .eq('id', resolvedInstitutionId)
    .maybeSingle()
  institutionName = inst?.name ?? 'Unknown Institution'
  logoUrl = inst?.logo_url ?? null

  return (
    <EnterprisePortalClient
      institutionId={resolvedInstitutionId}
      institutionName={institutionName}
      logoUrl={logoUrl}
    />
  )
}
