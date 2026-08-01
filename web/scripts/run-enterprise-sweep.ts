#!/usr/bin/env npx tsx
/**
 * FF-035-B: Run enterprise sweep (Fork 1 + Fork 2) against demo-auto-finance.
 * Direct library call — no HTTP.
 * Run: npx tsx scripts/run-enterprise-sweep.ts
 */
import * as fs from 'fs'
import * as path from 'path'

// Load .env.local manually
const envPath = path.join(__dirname, '../.env.local')
for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim()
}

import { runPortfolioSweep } from '../lib/enterprise/sweep-fork1'
import { runObjectiveSweep } from '../lib/enterprise/sweep-fork2'
import { createClient } from '@supabase/supabase-js'

const INSTITUTION_ID = 'a1b2c3d4-0000-0000-0000-0000000000de'


async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('FF-035-B — Enterprise Sweep Verification')
  console.log(`Institution: demo-auto-finance (${INSTITUTION_ID})`)
  console.log('═══════════════════════════════════════════\n')

  // ── Fork 1 ──
  console.log('▶ Running Fork 1 (portfolio sweep)...')
  const fork1 = await runPortfolioSweep(INSTITUTION_ID)
  console.log(`✓ Fork 1 complete in ${fork1.durationMs}ms`)
  console.log(`  Health score:  ${fork1.healthScore}`)
  console.log(`  Tier counts:   CRITICAL=${fork1.tierCounts.critical} ALERT=${fork1.tierCounts.alert} CAUTION=${fork1.tierCounts.caution} STABLE=${fork1.tierCounts.stable}`)
  console.log(`  Cohorts flagged: ${fork1.highRiskCohorts.length}`)
  for (const c of fork1.highRiskCohorts) {
    const yearPart = c.origination_year ? ` (${c.origination_year})` : ''
    const empPart = c.employment_type ? ` × ${c.employment_type}` : ''
    console.log(`    - ${c.region} × ${c.fico_band}${empPart}${yearPart}: ${c.delinquent_count}/${c.case_count} delinquent (${(c.delinquency_rate*100).toFixed(0)}%) — ${c.case_refs.join(', ')}`)
  }
  console.log(`  Projected changes: ${fork1.projectedTierChanges.length}`)
  for (const p of fork1.projectedTierChanges) {
    console.log(`    - ${p.case_ref}: ${p.current_tier} → ${p.projected_tier} (${Math.round(p.confidence*100)}%)`)
  }
  console.log(`  sweep_id:   ${fork1.sweepId}`)
  console.log(`  metrics_id: ${fork1.metricsId}`)

  // AH-HA CHECK
  const seKeyFico = fork1.highRiskCohorts.find(c =>
    c.region === 'Southeast' && c.fico_band === '620-659'
  )
  console.log('\n  ── AH-HA CHECK ──')
  console.log(`  Southeast + 620-659 cohort flagged: ${seKeyFico ? 'YES ✓' : 'NO ✗'}`)
  if (seKeyFico) {
    console.log(`    ${seKeyFico.case_refs.join(', ')} | rate=${(seKeyFico.delinquency_rate*100).toFixed(0)}%`)
  }

  // ── Fork 2: Load focus objectives ──
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: objectives } = await supabase
    .from('enterprise_objectives')
    .select('id, obj_id, objective_state')
    .eq('institution_id', INSTITUTION_ID)
    .eq('status', 'active')
    .eq('objective_state', 'focus')
    .order('objective_order')

  console.log(`\n▶ Running Fork 2 for ${objectives?.length ?? 0} focus objectives...`)

  const fork2Results = []
  const failed: string[] = []

  for (const obj of objectives ?? []) {
    process.stdout.write(`  ${obj.obj_id}... `)
    try {
      const result = await runObjectiveSweep(INSTITUTION_ID, obj.id as string, fork1.metricsId)
      fork2Results.push(result)
      console.log(`✓ (${result.durationMs}ms, confidence=${result.confidenceScore.toFixed(2)}, alert=${result.alertTriggered})`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`✗ FAILED: ${msg}`)
      failed.push(obj.obj_id as string)
    }
  }

  // ── Verification queries ──
  console.log('\n═══════════════════════════════════════════')
  console.log('VERIFICATION QUERY RESULTS')
  console.log('═══════════════════════════════════════════\n')

  // Query 1 — Fork 1 metrics
  const { data: metricsRow } = await supabase
    .from('enterprise_portfolio_metrics')
    .select('portfolio_health_score, critical_count, alert_count, caution_count, stable_count, delinquency_rate_pct, high_risk_cohorts, projected_tier_changes')
    .eq('institution_id', INSTITUTION_ID)
    .order('computed_at', { ascending: false })
    .limit(1)
    .single()

  console.log('── Query 1: Fork 1 metrics ──')
  if (metricsRow) {
    const m = metricsRow as Record<string, unknown>
    console.log(`health_score=${m.portfolio_health_score} critical=${m.critical_count} alert=${m.alert_count} caution=${m.caution_count} stable=${m.stable_count}`)
    console.log(`delinquency_rate=${((m.delinquency_rate_pct as number)*100).toFixed(1)}%`)
    console.log(`cohort_flags=${(m.high_risk_cohorts as unknown[])?.length ?? 0}`)
    console.log(`projections=${(m.projected_tier_changes as unknown[])?.length ?? 0}`)
  }

  // Query 2 — Fork 2 results
  const { data: resultRows } = await supabase
    .from('enterprise_objective_results')
    .select('objective_id, sweep_type, confidence_score, alert_triggered, affecting_it')
    .eq('institution_id', INSTITUTION_ID)
    .order('computed_at', { ascending: false })
    .limit(10)

  console.log('\n── Query 2: Fork 2 objective results ──')
  for (const r of resultRows ?? []) {
    const objMatch = (objectives ?? []).find(o => o.id === r.objective_id)
    const objId = objMatch?.obj_id ?? r.objective_id
    const preview = (r.affecting_it as string)?.slice(0, 120) ?? ''
    console.log(`${objId} | ${r.sweep_type} | conf=${(r.confidence_score as number).toFixed(2)} | alert=${r.alert_triggered}`)
    console.log(`  "${preview}..."`)
  }

  // Query 3 — Drift tiers
  const { data: driftRows } = await supabase
    .from('enterprise_case_history')
    .select('case_ref, drift_score, drift_tier')
    .eq('institution_id', INSTITUTION_ID)
    .like('case_ref', 'TC-%')
    .not('drift_tier', 'is', null)
    .order('drift_score', { ascending: false })

  console.log('\n── Query 3: Case drift tiers ──')
  for (const d of driftRows ?? []) {
    console.log(`${d.case_ref}: score=${d.drift_score} tier=${d.drift_tier}`)
  }

  // E-01 AH-HA: does affecting_it mention TC-A refs?
  const e01result = fork2Results.find(r => r.objId === 'E-01')
  if (e01result) {
    console.log('\n── E-01 AH-HA CHECK ──')
    const tcAMentioned = ['TC-A001','TC-A002','TC-A003','TC-A004','TC-A005'].filter(
      ref => e01result.affectingIt.includes(ref)
    )
    console.log(`TC-A refs mentioned unprompted: ${tcAMentioned.join(', ') || 'NONE'}`)
    console.log(`finding_type: (check raw result in Supabase)`)
    console.log(`confidence: ${e01result.confidenceScore.toFixed(2)}`)
  }

  console.log('\n═══════════════════════════════════════════')
  console.log(`Objectives swept: ${fork2Results.length}, Failed: ${failed.length}`)
  if (failed.length) console.log(`Failed: ${failed.join(', ')}`)
  console.log('READY FOR JASON REVIEW — do not merge')
  console.log('═══════════════════════════════════════════')
}

main().catch(e => { console.error(e); process.exit(1) })
