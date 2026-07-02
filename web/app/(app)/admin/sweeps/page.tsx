import { notFound } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireAdminUser } from '@/lib/admin/requireAdminUser'
import AdminSweepsClient from './AdminSweepsClient'

export const dynamic = 'force-dynamic'

interface AccountRow {
  sweep_status: string
  email_status: string
}

export default async function AdminSweepsPage() {
  const supabase = createClient()
  // Route-protect the same way as the API route — 404 for anyone but
  // Jason, not just a hidden nav link.
  const admin = await requireAdminUser(supabase)
  if (!admin) notFound()

  const service = createServiceClient()

  const [{ data: profiles }, { data: usersData }, { data: jobs }] = await Promise.all([
    service.from('profiles').select('id, full_name, account_type').order('created_at', { ascending: false }),
    service.auth.admin.listUsers({ perPage: 1000 }),
    service.from('bulk_sweep_jobs')
      .select('*, bulk_sweep_job_accounts(sweep_status, email_status)')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const emailById = new Map(usersData?.users.map(u => [u.id, u.email ?? '']) ?? [])

  const accounts = (profiles ?? []).map(p => ({
    id: p.id,
    email: emailById.get(p.id) ?? '(no email)',
    fullName: p.full_name as string | null,
    accountType: p.account_type as string | null,
  }))

  const jobSummaries = (jobs ?? []).map(j => {
    const accts = (j.bulk_sweep_job_accounts ?? []) as AccountRow[]
    return {
      id: j.id as string,
      cohortFilter: j.cohort_filter as string,
      status: j.status as string,
      scheduledAt: j.scheduled_at as string | null,
      startedAt: j.started_at as string | null,
      completedAt: j.completed_at as string | null,
      createdAt: j.created_at as string,
      total: accts.length,
      succeeded: accts.filter(a => a.sweep_status === 'complete').length,
      failed: accts.filter(a => a.sweep_status === 'failed').length,
      emailsSent: accts.filter(a => a.email_status === 'sent').length,
    }
  })

  return <AdminSweepsClient accounts={accounts} jobs={jobSummaries} />
}
