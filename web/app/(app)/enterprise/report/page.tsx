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

  const iidParam = searchParams?.iid ?? null

  let institutionId: string
  let institutionName: string

  if (iidParam) {
    const { data: inst } = await supabase
      .from('enterprise_institutions')
      .select('id, name')
      .eq('id', iidParam)
      .eq('status', 'active')
      .maybeSingle()
    institutionId = inst?.id ?? iidParam
    institutionName = inst?.name ?? 'Unknown Institution'
  } else {
    const { data: institution } = await supabase
      .from('enterprise_institutions')
      .select('id, name')
      .eq('contact_email', user.email)
      .single()
    institutionId = institution?.id ?? 'a1b2c3d4-0000-0000-0000-000000000001'
    institutionName = institution?.name ?? 'Conquer Group / DefaultShield'
  }

  const highlight = searchParams?.highlight ?? null
  const verticalConfig = await getVerticalConfig(institutionId)

  return (
    <EnterpriseReportClient
      institutionId={institutionId}
      institutionName={institutionName}
      highlight={highlight}
      verticalConfig={verticalConfig}
    />
  )
}
