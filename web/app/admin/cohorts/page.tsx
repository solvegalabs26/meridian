import { createServiceClient } from '@/lib/supabase/server'
import CohortConfigClient from './CohortConfigClient'

export const dynamic = 'force-dynamic'

export interface CohortConfig {
  id: string
  org_name: string
  org_code: string
  section_cohort_overview: boolean
  section_objective_tracking: boolean
  section_confidence_trends: boolean
  section_sweep_activity: boolean
  section_cross_dep_flags: boolean
  section_engagement_summary: boolean
  section_predictions_active: boolean
  section_top_signals: boolean
  delivery_email: boolean
  delivery_drive: boolean
  recipient_emails: string[] | null
  drive_folder_id: string | null
  drive_folder_name: string | null
  send_frequency: string
  send_day: string | null
  last_sent_at: string | null
  created_at: string
  updated_at: string
}

export default async function AdminCohortsPage() {
  const service = createServiceClient()

  const { data: configs, error } = await service
    .from('cohort_report_configs')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[admin/cohorts] fetch error:', error)
  }

  // Per-org enrolled user counts (consent = true)
  const orgCodes = (configs ?? []).map(c => (c as CohortConfig).org_code)
  let enrolledCounts: Record<string, number> = {}

  if (orgCodes.length > 0) {
    const { data: profileRows } = await service
      .from('profiles')
      .select('org_source')
      .in('org_source', orgCodes)
      .eq('cohort_data_consent', true)

    for (const row of profileRows ?? []) {
      const oc = row.org_source as string
      enrolledCounts[oc] = (enrolledCounts[oc] ?? 0) + 1
    }
  }

  return (
    <CohortConfigClient
      configs={(configs ?? []) as CohortConfig[]}
      enrolledCounts={enrolledCounts}
    />
  )
}
