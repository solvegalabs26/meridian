/**
 * Seed Jason's 5 active objectives into Supabase.
 * Run with: npx ts-node --project tsconfig.json scripts/seed-objectives.ts
 * Or execute the SQL directly via supabase/seed-objectives.sql
 */

const JASON_USER_ID = '817b615a-c2c5-4285-8763-bdea3e171e2d'

const objectives = [
  {
    user_id: JASON_USER_ID,
    obj_id: 'OBJ-01',
    title: 'Alaska Airlines First Officer Hire',
    category: 'Career/Aviation',
    outcome: 'Receive and accept a Conditional Job Offer from Alaska Airlines as a First Officer with a confirmed training class date, advancing my pilot career from regional to major airline.',
    success_condition: 'Notified when application is open. Successful application submission. Interview invitation and completion. Conditional Job Offer with First Officer training class expectation and hard date.',
    target_date: '2026-11-30',
    status: 'active',
    confidence: 74,
    confidence_prev: 82,
    sweep_frequency: 'weekly',
    signal_keywords: ['Alaska Airlines', 'pilot hiring', 'Boeing 737 MAX 10 certification', 'PAPA', 'OBAP', 'First Officer', 'CJO pool', 'airline pilot hiring 2026'],
    notes: 'Hiring pause confirmed early 2026 pending Boeing 737 MAX 10 certification. Sean (Alaska FO) confirmed fall hiring intent and offered LOR. PAPA = mini-interview resume flag system. OBAP conference Aug 12-14 Chicago — hotel deadline July 21, register now. CJO backlog from 2023 gets priority when Alaska reopens. Confidence dropped from 82% to 74% due to Boeing MAX 10 delivery delays.',
    sort_order: 1,
  },
  {
    user_id: JASON_USER_ID,
    obj_id: 'OBJ-06',
    title: 'Retirement Readiness Preparation',
    category: 'Finance',
    outcome: 'Realize $650k in investment account and coupled with savings and pension in 12 years, establish a retirement strategy for continued growth through age 90. Maintain current standard of living and enjoy retired life.',
    success_condition: 'In 12 years, based on retirement calculations of funds needed from pensions, current paychecks, employer contributions, savings, and future events, maintain $10k/month standard of living budget through age 90.',
    target_date: '2027-07-01',
    status: 'active',
    confidence: 54,
    confidence_prev: 54,
    sweep_frequency: 'weekly',
    signal_keywords: ['retirement planning', 'investment returns 2026', 'inflation forecast', 'military pension', 'VA disability', 'Raymond James', 'mutual funds', 'market conditions'],
    notes: 'Age 50. Current: $120k Raymond James investment account, $30k savings, $12k 401k, military pension $65k/year with VA COLA, VA disability $2500/month, salary $107k/year. Mold remediation $12-16k is near-term cash draw starting July 2026. Emergency CD matures July 2026 ($10k). Wildcard: Solvega Labs/Meridian exit changes picture entirely. Risk level moderate.',
    sort_order: 2,
  },
  {
    user_id: JASON_USER_ID,
    obj_id: 'OBJ-12',
    title: 'Fitness and Weight Goal',
    category: 'Health',
    outcome: 'Weigh 5 lbs less than current starting weight of 172 lbs, noticeably reduced belly and waistline, improved energy levels on trip days and layovers, sustainable daily habits established beyond the 90-day window.',
    success_condition: 'Scale reads 5 lbs below starting weight (165 lbs) on day 90. Waist measurement reduced by at least 1 inch. Feeling physically stronger and less fatigued on multi-leg flying days.',
    target_date: '2026-09-15',
    status: 'active',
    confidence: 60,
    confidence_prev: 60,
    sweep_frequency: 'weekly',
    signal_keywords: ['shift worker fitness', 'pilot fitness schedule', 'intermittent fasting irregular schedule', 'hotel gym workout', 'visceral fat reduction', 'protein diet travel'],
    notes: 'Starting weight 172 lbs, target 165 lbs by July 30 2026. Primary constraint is irregular pilot schedule — 3-4 day pairings make consistent gym access and meal timing difficult. Core levers: protein-forward meals, daily movement, sleep quality. Measure weekly not daily — hydration variance is 2-3 lbs. Elk hunt Aug-Sep is end of 90-day window and motivating physical target. Disneyland and Spain are positive motivation anchors.',
    sort_order: 3,
  },
  {
    user_id: JASON_USER_ID,
    obj_id: 'OBJ-13',
    title: 'Meridian Product Build',
    category: 'Business',
    outcome: 'The first to market Persistent Objective State product layer — a working publicly accessible Meridian platform tracking user objectives against real-world signals, delivering weekly intelligence reports and confidence scores, ready for beta users.',
    success_condition: 'Mission Control Dashboard live and functional. At least 10 beta users active with real objectives tracked. System delivering automated signal sweeps, confidence scores, and actionable recommendations without requiring manual Claude sessions. Founder journal proof of concept complete with 30 weeks of comparative data.',
    target_date: '2026-12-31',
    status: 'active',
    confidence: 82,
    confidence_prev: 61,
    sweep_frequency: 'weekly',
    signal_keywords: ['Persistent Objective State', 'agentic memory startup', 'Mem0', 'MemOS', 'AI life planning', 'Anthropic API', 'objective tracking AI', 'POS intelligence'],
    notes: 'Phase 1 build complete June 23 2026. Live at meridian-chi-gilt.vercel.app. All 8 Supabase tables created with RLS. Supabase Auth working with email and Google OAuth. Next: Phase 2 objectives and brand components. Wizard of Oz 30-week experiment running in parallel. External beta user (Stackably founder) tracking OBJ-18/19/20. PRED-002 confidence updated to 75%+ after Phase 1 completion.',
    sort_order: 4,
  },
  {
    user_id: JASON_USER_ID,
    obj_id: 'OBJ-14',
    title: 'Solvega Labs Business Build',
    category: 'Business',
    outcome: 'Solvega Labs LLC is a legally registered Utah LLC with EIN obtained, business bank account open, domains secured, and foundational business infrastructure in place to receive funding, hire team members, and generate revenue through Meridian.',
    success_condition: 'Utah LLC registration confirmed by Utah Division of Corporations. EIN issued by IRS. Business bank account open. Domains solvega.com, solvega.ai, solvegalabs.com acquired. Operating agreement drafted. Business registered with startup.utah.gov ecosystem for funding eligibility.',
    target_date: '2026-10-01',
    status: 'active',
    confidence: 88,
    confidence_prev: 85,
    sweep_frequency: 'weekly',
    signal_keywords: ['Utah LLC filing', 'Solvega Labs', 'startup.utah.gov', 'SBIR grant AI tools', 'Utah angel investors', 'Silicon Slopes', 'Venn Utah', 'USPTO trademark Class 42'],
    notes: 'Name finalized as Solvega Labs. Sol (sun) + Vega (future North Star). Domains solvega.com, solvega.ai, solvegalabs.com confirmed available — PRED-003 deadline June 26 (3 days). Supabase project named solvegaLab\'s Org. GitHub, Vercel, Supabase all established. LLC filing ~$70 at corporations.utah.gov. USPTO Intent-to-Use Class 42 filing needed before any public launch.',
    sort_order: 5,
  },
]

console.log('Seed data prepared for', objectives.length, 'objectives')
console.log('Run the SQL in supabase/seed-objectives.sql instead for direct insertion.')
export { objectives, JASON_USER_ID }
