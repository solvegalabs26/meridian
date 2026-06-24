export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Get last sweep time
  const { data: lastSweep } = await supabase
    .from('sweeps')
    .select('completed_at')
    .eq('user_id', user.id)
    .eq('status', 'complete')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single()

  return (
    <div className="min-h-screen bg-[var(--gray-lt)]">
      <Sidebar />
      <div className="ml-60">
        <TopBar
          userEmail={user.email}
          lastSweepAt={lastSweep?.completed_at ?? null}
        />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
