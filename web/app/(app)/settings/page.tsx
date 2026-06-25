import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsClient from './SettingsClient'
import CalendarConnect from '@/components/settings/CalendarConnect'

export default async function SettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="max-w-2xl space-y-4">
      <SettingsClient
        email={user.email ?? ''}
        profile={profile}
      />
      <CalendarConnect
        initialUrl={(profile as { calendar_ical_url?: string } | null)?.calendar_ical_url ?? null}
      />
    </div>
  )
}
