import { createClient } from '@/lib/supabase/server'

export default async function SettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  return (
    <div className="max-w-2xl">
      <h1 className="text-[22px] font-medium text-[var(--text)] mb-1">Settings</h1>
      <p className="text-[14px] text-[var(--text3)] mb-6">Profile and preferences — full settings UI in Phase 6.</p>

      <div className="bg-white rounded-2xl border border-[var(--border)] p-6">
        <h2 className="text-[15px] font-medium text-[var(--text)] mb-4">Account</h2>
        <div className="space-y-3 text-[13px]">
          <div className="flex justify-between py-2 border-b border-[var(--border)]">
            <span className="text-[var(--text3)]">Email</span>
            <span className="text-[var(--text2)]">{user?.email}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[var(--border)]">
            <span className="text-[var(--text3)]">Name</span>
            <span className="text-[var(--text2)]">{profile?.full_name ?? '—'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[var(--border)]">
            <span className="text-[var(--text3)]">Tier</span>
            <span className="capitalize text-[var(--text2)]">{profile?.tier ?? 'trial'}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-[var(--text3)]">Member since</span>
            <span className="text-[var(--text2)]">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
