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

  // Solvega admins can view any institution
  const isAdmin = user.email?.endsWith('@solvegalabs.com') || user.email === 'ghostnet5x5@gmail.com'

  if (!institution && !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-200 mb-2">Enterprise Access Required</h2>
          <p className="text-gray-400 text-sm">Your account is not associated with an enterprise institution.</p>
          <p className="text-gray-500 text-xs mt-2">Contact support@solvegalabs.com to get access.</p>
        </div>
      </div>
    )
  }

  // Admin fallback: show Conquer Group
  const institutionId = institution?.id ?? 'a1b2c3d4-0000-0000-0000-000000000001'
  const institutionName = institution?.name ?? 'Conquer Group / DefaultShield'

  return (
    <EnterprisePortalClient
      institutionId={institutionId}
      institutionName={institutionName}
      isAdmin={isAdmin}
    />
  )
}
