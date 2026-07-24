-- ===========================================================================
-- 20260723_security_hardening_session17.sql
--
-- Meridian Arc / Solvega Labs LLC
-- Session 17 — Enterprise gate hardening
-- Applied via Supabase SQL editor, July 23 2026. Backfilled to migrations
-- for version control and SOC2 change-history evidence.
--
-- CONTEXT
--   These statements were executed live in the dashboard during the Jul 23
--   build session and are recorded here after the fact. Running this file
--   against a database that already has them applied is safe — every
--   statement is guarded or idempotent.
--
-- SECTIONS
--   1. RLS: remove unauthenticated read access to enterprise tables  (CRITICAL)
--   2. Demo institution separation (Option C)
--   3. Conquer Group DPA gate closure
--   4. Demo account provisioning workaround
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. CRITICAL — Remove anon read policies from enterprise tables
--
-- FINDING (Jul 23, 2026): four enterprise tables carried permissive SELECT
-- policies granted to the `anon` role with USING (true) — no filter at all.
-- The anon role is keyed by NEXT_PUBLIC_SUPABASE_ANON_KEY, which ships in the
-- client-side JavaScript bundle on every page load. Any unauthenticated
-- visitor could extract that key and read every row of every institution's
-- case data directly via PostgREST.
--
-- Postgres permissive policies are OR'd, so the coexisting
-- "service role only" policy provided no constraint whatsoever.
--
-- EXPOSURE ASSESSMENT: no client data was present at any point. The only
-- rows in these tables were 5 synthetic demo loans authored by Solvega Labs.
-- Conquer Group's portfolio had not been ingested (DPA unsigned). No known
-- access occurred. Policies almost certainly introduced during the FF-016
-- enterprise portal build (Jul 21-22) to enable client-side reads, and never
-- revisited.
--
-- enterprise_objectives was never granted anon access — it correctly carried
-- only the service-role policy, which is what all five should have looked like.
--
-- REMAINING WORK: the `authenticated` policies below still use USING (true),
-- meaning any signed-in user can read every institution's data. This is the
-- cross-institution isolation gap. It requires a membership table
-- (enterprise_members) and scoped policies, and MUST be closed before any
-- real client portfolio is ingested.
-- ---------------------------------------------------------------------------

drop policy if exists "anon_read_cases"        on public.enterprise_cases;
drop policy if exists "anon_read_institutions" on public.enterprise_institutions;
drop policy if exists "anon_read_predictions"  on public.enterprise_predictions;
drop policy if exists "anon_read_sweeps"       on public.enterprise_sweeps;


-- ---------------------------------------------------------------------------
-- 2. Demo institution separation (Option C)
--
-- PROBLEM: the 5 synthetic FF-016 demo cases were loaded under the real
-- Conquer Group institution row. Running the demo sweep required
-- dpa_signed_at to be non-null (middleware gate, Security Constraint #9), so
-- the timestamp was set on Jul 21 at 23:01:30 — four minutes before the first
-- demo sweep at 23:05:09 — on a DPA that had never been executed. The primary
-- technical control enforcing Security Constraint #1 was therefore disarmed
-- on the exact institution it existed to protect.
--
-- SOLUTION: a permanent synthetic demo institution owned outright by Solvega
-- Labs. dpa_signed_at is legitimately set here because Solvega is both
-- controller and processor of data it authored; there is no counterparty and
-- no DPA to execute. Prospect demos and DPA-gate testing now run against this
-- row, so no compliance control is ever toggled on a live client record.
-- ---------------------------------------------------------------------------

insert into public.enterprise_institutions
  (id, slug, name, industry, contact_name, contact_email,
   tier, status, pilot_started_at, monthly_fee_usd, dpa_signed_at,
   notes, config)
values (
  'a1b2c3d4-0000-0000-0000-0000000000de',
  'demo-auto-finance',
  'Meridian Arc Demo — Auto Finance',
  'auto_finance',
  'Jason Moffat',
  'connect@solvega.ai',
  'pilot',
  'active',
  now(),
  null,
  now(),
  'SYNTHETIC DEMO INSTITUTION — NOT A CLIENT. All case data is fabricated '
  || 'by Solvega Labs LLC for demonstration and testing. Contains no real '
  || 'borrower data and no client data of any kind. dpa_signed_at is set '
  || 'because Solvega is both controller and processor of synthetic data it '
  || 'authored; there is no counterparty. Use this row for all prospect '
  || 'demos and for DPA-gate / RLS testing. Never load client data here.',
  '{"regions": ["Midwest", "Great Lakes", "Southeast"],
    "sweep_day": "monday",
    "vehicle_focus": "truck_heavy",
    "industry_vertical": "auto_finance",
    "synthetic": true,
    "demo_environment": true}'::jsonb
)
on conflict (id) do nothing;

-- Move the objective and de-brand it. OBJ-CG-001 -> OBJ-DEMO-001 keeps the
-- Conquer Group namespace free for the real objective when his portfolio
-- eventually loads.
update public.enterprise_objectives
set institution_id = 'a1b2c3d4-0000-0000-0000-0000000000de',
    obj_id         = 'OBJ-DEMO-001',
    statement      = 'Identify which active loans in the portfolio are '
                  || 'drifting toward delinquency within 90 days, by fusing '
                  || 'historical borrower and vehicle signals with live '
                  || 'external market data, and surface ranked recommended '
                  || 'actions.',
    updated_at     = now()
where id = 'b2c3d4e5-0000-0000-0000-000000000001';

-- Move the synthetic records: 5 cases, 5 sweeps, 20 predictions.
update public.enterprise_cases
set institution_id = 'a1b2c3d4-0000-0000-0000-0000000000de', updated_at = now()
where institution_id = 'a1b2c3d4-0000-0000-0000-000000000001';

update public.enterprise_sweeps
set institution_id = 'a1b2c3d4-0000-0000-0000-0000000000de'
where institution_id = 'a1b2c3d4-0000-0000-0000-000000000001';

update public.enterprise_predictions
set institution_id = 'a1b2c3d4-0000-0000-0000-0000000000de'
where institution_id = 'a1b2c3d4-0000-0000-0000-000000000001';


-- ---------------------------------------------------------------------------
-- 3. Conquer Group DPA gate closure
--
-- dpa_signed_at nulled. The Jul 21 timestamp did not reflect an executed DPA;
-- as of Jul 23 the DPA is drafted, the attorney has been contacted, and the
-- call is pending. Per Security Constraint #1, no data may be accepted until
-- the DPA is signed, PII strip is confirmed, and attorney review is complete.
-- Do not set this column again until all three are true.
-- ---------------------------------------------------------------------------

update public.enterprise_institutions
set dpa_signed_at = null,
    updated_at = now()
where id = 'a1b2c3d4-0000-0000-0000-000000000001';


-- ---------------------------------------------------------------------------
-- 4. Demo account provisioning workaround  [TEMPORARY — see FF-026]
--
-- PROBLEM: two triggers on auth.users disagree about new enterprise accounts.
--   tag_enterprise_user_on_signup (BEFORE INSERT) sets
--     raw_app_meta_data.enterprise_only = true
--   handle_new_user (AFTER INSERT) creates the profile with personal
--     defaults: account_type = 'personal', onboarded_at = null
--
-- Result: middleware walls the user to /enterprise/* because of the app_metadata
-- flag, while the app pushes them to /onboarding/sweep because onboarded_at is
-- null. The two fight and the browser reports ERR_TOO_MANY_REDIRECTS. Verified
-- live on connect@solvega.ai, Jul 23 2026. Darren Nitz would have hit this on
-- first login during the demo call.
--
-- WORKAROUND: stamp onboarded_at manually. Confirmed to resolve the loop —
-- the enterprise portal renders correctly afterward, so no middleware change
-- is required.
--
-- PERMANENT FIX (FF-026): handle_new_user() should read enterprise_only off
-- NEW.raw_app_meta_data — trigger ordering guarantees the BEFORE INSERT tag is
-- already present — and set account_type / onboarded_at accordingly. Deferred
-- because introducing an 'enterprise' account_type value requires auditing
-- every read of that column first.
-- ---------------------------------------------------------------------------

update public.profiles p
set onboarded_at = coalesce(p.onboarded_at, now()),
    full_name    = coalesce(p.full_name, 'Meridian Arc Demo'),
    updated_at   = now()
from auth.users u
where u.id = p.id
  and u.email = 'connect@solvega.ai';


-- ===========================================================================
-- VERIFICATION
-- ===========================================================================
-- select tablename, policyname, roles::text from pg_policies
--   where schemaname='public' and tablename like 'enterprise_%' order by 1,2;
--   -- expect: no {anon} rows
--
-- select i.slug, i.dpa_signed_at,
--        (select count(*) from public.enterprise_cases c where c.institution_id=i.id) as cases
--   from public.enterprise_institutions i order by i.slug;
--   -- expect: conquer-group | null | 0
--   --         demo-auto-finance | <ts> | 5
-- ===========================================================================
