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

  const iidParam = searchParams?.iid ?? null

  let institutionId: string
  let institutionName: string
  let logoUrl: string | null

  if (iidParam) {
    // iid provided — look up by id; RLS blocks data if user isn't a member
    const { data: inst } = await supabase
      .from('enterprise_institutions')
      .select('id, name, logo_url')
      .eq('id', iidParam)
      .eq('status', 'active')
      .maybeSingle()
    institutionId = inst?.id ?? iidParam
    institutionName = inst?.name ?? 'Unknown Institution'
    logoUrl = inst?.logo_url ?? null
  } else {
    // Default: resolve by contact email
    const { data: institution } = await supabase
      .from('enterprise_institutions')
      .select('id, name, logo_url')
      .eq('contact_email', user.email)
      .eq('status', 'active')
      .single()
    institutionId = institution?.id ?? 'a1b2c3d4-0000-0000-0000-000000000001'
    institutionName = institution?.name ?? 'Conquer Group / DefaultShield'
    logoUrl = institution?.logo_url ?? null
  }

  return (
    <EnterprisePortalClient
      institutionId={institutionId}
      institutionName={institutionName}
      logoUrl={logoUrl}
    />
  )
}
