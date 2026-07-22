import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EnterprisePortalClient from './EnterprisePortalClient'

export const metadata = { title: 'Enterprise Portal — Meridian Arc' }

export default async function EnterprisePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Look up institution by contact email
  const { data: institution } = await supabase
    .from('enterprise_institutions')
    .select('id, name, slug, tier, pilot_started_at, monthly_fee_usd')
    .eq('contact_email', user.email)
    .eq('status', 'active')
    .single()

  // Pilot mode: any authenticated user sees enterprise portal
  // Institution lookup determines whose data to show; fall back to Conquer Group
  const institutionId = institution?.id ?? 'a1b2c3d4-0000-0000-0000-000000000001'
  const institutionName = institution?.name ?? 'Conquer Group / DefaultShield'

  return (
    <EnterprisePortalClient
      institutionId={institutionId}
      institutionName={institutionName}
    />
  )
}
