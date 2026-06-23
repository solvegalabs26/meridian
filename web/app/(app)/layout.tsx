export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-[var(--gray-lt)]">
      <Sidebar />
      <div className="ml-60">
        <TopBar userEmail={user.email} />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
