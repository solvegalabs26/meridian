import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EnterpriseReportClient from './EnterpriseReportClient'

export const metadata = { title: 'Sweep Intelligence Report — Meridian Arc' }

export default async function EnterpriseReportPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: institution } = await supabase
    .from('enterprise_institutions')
    .select('id, name')
    .eq('contact_email', user.email)
    .single()
  const institutionId = institution?.id ?? 'a1b2c3d4-0000-0000-0000-000000000001'
  const institutionName = institution?.name ?? 'Conquer Group / DefaultShield'
  return <EnterpriseReportClient institutionId={institutionId} institutionName={institutionName} />
}
