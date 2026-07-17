import type { SupabaseClient } from '@supabase/supabase-js'
import type { CohortReportSections } from './types'
import { ACTIVE_ACCOUNT_TYPES } from './types'
import { fetchCohortOverview } from './sections/fetchCohortOverview'
import { fetchObjectiveTracking } from './sections/fetchObjectiveTracking'
import { fetchConfidenceTrends } from './sections/fetchConfidenceTrends'
import { fetchSweepActivity } from './sections/fetchSweepActivity'
import { fetchCrossDepFlags } from './sections/fetchCrossDepFlags'
import { fetchEngagementSummary } from './sections/fetchEngagementSummary'
import { fetchPredictionsActive } from './sections/fetchPredictionsActive'
import { fetchTopSignals } from './sections/fetchTopSignals'
import { renderCohortPdf } from './renderPdf'

export async function generateCohortReport(
  service: SupabaseClient,
  orgCode: string
): Promise<Buffer> {
  // 1. Load config
  const { data: config, error: configErr } = await service
    .from('cohort_report_configs')
    .select('*')
    .eq('org_code', orgCode)
    .single()

  if (configErr || !config) {
    throw new Error(`No cohort config found for org_code: ${orgCode}`)
  }

  // 2. Load consented users for this org
  const { data: profiles } = await service
    .from('profiles')
    .select('id')
    .eq('org_source', orgCode)
    .eq('cohort_data_consent', true)
    .in('account_type', ACTIVE_ACCOUNT_TYPES)

  const userIds = (profiles ?? []).map(p => p.id as string)

  if (userIds.length === 0) {
    throw new Error(`No consented users found for org_code: ${orgCode}`)
  }

  // 3. Period: last 30 days
  const periodStart = new Date()
  periodStart.setDate(periodStart.getDate() - 30)
  const periodLabel = `${periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

  // 4. Fetch sections in parallel (only enabled ones)
  const [
    cohortOverview,
    objectiveTracking,
    confidenceTrends,
    sweepActivity,
    crossDepFlags,
    engagementSummary,
    predictionsActive,
    topSignals,
  ] = await Promise.all([
    config.section_cohort_overview    ? fetchCohortOverview(service, userIds, periodStart)    : Promise.resolve(undefined),
    config.section_objective_tracking ? fetchObjectiveTracking(service, userIds)              : Promise.resolve(undefined),
    config.section_confidence_trends  ? fetchConfidenceTrends(service, userIds)              : Promise.resolve(undefined),
    config.section_sweep_activity     ? fetchSweepActivity(service, userIds, periodStart)    : Promise.resolve(undefined),
    config.section_cross_dep_flags    ? fetchCrossDepFlags(service, userIds, periodStart)    : Promise.resolve(undefined),
    config.section_engagement_summary ? fetchEngagementSummary(service, userIds, periodStart): Promise.resolve(undefined),
    config.section_predictions_active ? fetchPredictionsActive(service, userIds)             : Promise.resolve(undefined),
    config.section_top_signals        ? fetchTopSignals(service, userIds, periodStart)       : Promise.resolve(undefined),
  ])

  const sections: CohortReportSections = {
    cohortOverview,
    objectiveTracking,
    confidenceTrends,
    sweepActivity,
    crossDepFlags,
    engagementSummary,
    predictionsActive,
    topSignals,
  }

  // 5. Render PDF
  return renderCohortPdf(config.org_name as string, periodLabel, sections)
}
