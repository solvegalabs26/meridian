export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ConciergePage } from './ConciergePage'
import { userVoiceTier } from '@/lib/voice/voiceTier'

export default async function ConciergeRoute() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('tier, account_type, voice_addon, ask_credits')
    .eq('id', user.id)
    .single()

  const voiceTier = userVoiceTier({
    pricing_tier: (profile as { tier?: string | null } | null)?.tier ?? null,
    account_type: profile?.account_type ?? null,
    voice_addon: (profile as { voice_addon?: boolean | null } | null)?.voice_addon ?? false,
  })

  const askCredits = (profile as { ask_credits?: number | null } | null)?.ask_credits ?? 0

  return <ConciergePage voiceTier={voiceTier} askCredits={askCredits} />
}
