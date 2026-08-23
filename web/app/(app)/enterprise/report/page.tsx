import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getVerticalConfig } from '@/lib/vertical/getVerticalConfig'
import EnterpriseReportClient from './EnterpriseReportClient'

export const metadata = { title: 'Sweep Intelligence Report — Meridian Arc' }

export default async function EnterpriseReportPage({
  searchParams,
}: {
  searchParams?: { highlight?: string; iid?: string }
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

  let institutionName = 'Unknown Institution'
  if (institutionId) {
    const { data: inst } = await supabase
      .from('enterprise_institutions')
      .select('name')
      .eq('id', institutionId)
      .maybeSingle()
    institutionName = inst?.name ?? 'Unknown Institution'
  }

  const resolvedInstitutionId = institutionId ?? 'a1b2c3d4-0000-0000-0000-000000000001'

  const highlight = searchParams?.highlight ?? null
  const verticalConfig = await getVerticalConfig(resolvedInstitutionId)

  return (
    <EnterpriseReportClient
      institutionId={resolvedInstitutionId}
      institutionName={institutionName}
      highlight={highlight}
      verticalConfig={verticalConfig}
    />
  )
}
