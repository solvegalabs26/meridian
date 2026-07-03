import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdminUser } from '@/lib/admin/requireAdminUser'
import AdminNav from '@/components/admin/AdminNav'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const admin = await requireAdminUser(supabase)
  if (!admin) notFound()

  return (
    <div className="min-h-screen bg-[var(--gray-lt)] py-8 px-6">
      <div className="max-w-5xl mx-auto">
        <AdminNav />
        {children}
      </div>
    </div>
  )
}
