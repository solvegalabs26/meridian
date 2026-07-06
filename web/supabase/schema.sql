-- ============================================================
-- Meridian MVP — Database Schema
-- Run this in the Supabase SQL editor to set up all tables
-- ============================================================

-- ── profiles (extends auth.users) ──────────────────────────
create table public.profiles (
  id            uuid references auth.users(id) on delete cascade primary key,
  full_name     text,
  avatar_url    text,
  tier          text default 'trial',        -- trial | explorer | accelerator | command
  tone_pref     text default 'balanced',     -- direct | balanced | encouraging
  depth_pref    text default 'standard',     -- brief | standard | detailed
  trial_ends_at timestamptz,
  stripe_customer_id text,
  pricing_tier  text,                          -- set by invite-code redemption, e.g. 'lifetime_explorer'
  onboarded_at  timestamptz,
  sweep_count   int default 0,
  tutorial_views_count integer not null default 0,  -- auto-opens tutorial while < 2; never decremented
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── objectives ─────────────────────────────────────────────
create table public.objectives (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references public.profiles(id) on delete cascade not null,
  obj_id        text not null,               -- e.g. OBJ-01, OBJ-06
  title         text not null,
  category      text not null,               -- career | financial | personal | life
  outcome       text not null,               -- "I will have..."
  success_condition text,
  target_date   date,
  status        text default 'active',       -- active | paused | closed | achieved
  confidence    int  default 50,             -- 0–100
  confidence_prev int,
  sweep_frequency text default 'weekly',     -- weekly | daily | manual
  signal_keywords text[],
  notes         text,
  sort_order    int  default 0,
  goal_description text,                      -- original freeform description, verbatim as typed at creation
  goal_context  text,                          -- answers to AI clarifying questions asked at creation (Q&A text)
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index on public.objectives(user_id, status);
alter table public.objectives enable row level security;
create policy "Users can CRUD own objectives" on public.objectives
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── sweeps ─────────────────────────────────────────────────
create table public.sweeps (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references public.profiles(id) on delete cascade not null,
  status        text default 'pending',       -- pending | running | complete | failed
  trigger_type  text default 'manual',        -- manual | scheduled | webhook
  objectives_swept uuid[],
  signal_count  int,
  summary       text,
  raw_response  jsonb,
  tokens_used   int,
  cost_usd      numeric(10,6),
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz default now()
);

alter table public.sweeps enable row level security;
create policy "Users can CRUD own sweeps" on public.sweeps
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── signals ────────────────────────────────────────────────
create table public.signals (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references public.profiles(id) on delete cascade not null,
  objective_ids uuid[],
  sweep_id      uuid references public.sweeps(id),
  title         text not null,
  body          text,
  source        text,
  source_type   text,                           -- news | manual | reddit | linkedin
  relevance     text default 'medium',          -- high | medium | low
  signal_type   text,                           -- opportunity | risk | neutral | cross_dep
  is_cross_dep  boolean default false,
  is_read       boolean default false,
  created_at    timestamptz default now()
);

create index on public.signals(user_id, is_read, relevance);
alter table public.signals enable row level security;
create policy "Users can CRUD own signals" on public.signals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── confidence_scores ──────────────────────────────────────
create table public.confidence_scores (
  id            uuid default gen_random_uuid() primary key,
  objective_id  uuid references public.objectives(id) on delete cascade not null,
  user_id       uuid references public.profiles(id) on delete cascade not null,
  sweep_id      uuid references public.sweeps(id),
  score         int  not null,                -- 0–100
  factors       jsonb,                        -- {signal_quality, timeline, blockers, momentum}
  signal_gap    text,
  recommended_actions text[],
  created_at    timestamptz default now()
);

alter table public.confidence_scores enable row level security;
create policy "Users can CRUD own confidence scores" on public.confidence_scores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── predictions ────────────────────────────────────────────
create table public.predictions (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references public.profiles(id) on delete cascade not null,
  objective_id  uuid references public.objectives(id),
  pred_id       text,                         -- PRED-001, PRED-E001 etc.
  statement     text not null,
  confidence_pct int  not null,
  horizon_date  date not null,
  outcome       text,
  accuracy_score int,
  scored_at     timestamptz,
  notes         text,
  created_at    timestamptz default now()
);

alter table public.predictions enable row level security;
create policy "Users can CRUD own predictions" on public.predictions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── journal_entries ────────────────────────────────────────
create table public.journal_entries (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references public.profiles(id) on delete cascade not null,
  entry_number  int  not null,               -- 1–30
  week_of       date,
  section_a     text,
  section_b     text,
  section_c     jsonb,                          -- {obj, action, status}[] — per-objective actions/status log
  section_d     jsonb,                          -- narrative: concerns / open questions / key insight
  section_e     text,
  section_f     text,
  section_g     text,
  section_h_rating int,
  section_h_notes text,
  completed_actions jsonb default '[]'::jsonb,   -- {action, completed}[] — recommended actions marked done from an objective's "What to do" tab
  confidence_updates jsonb default '{}'::jsonb,  -- per-objective manual confidence assessment {prev, new, reason}, keyed by obj_id
  is_complete   boolean default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (user_id, entry_number)
);

alter table public.journal_entries enable row level security;
create policy "Users can CRUD own journal entries" on public.journal_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── rules_filter ───────────────────────────────────────────
create table public.rules_filter (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references public.profiles(id) on delete cascade not null,
  objective_id  uuid references public.objectives(id) on delete cascade not null,
  keywords_high text[],
  keywords_med  text[],
  keywords_low  text[],
  keywords_block text[],
  source_tiers  jsonb,
  updated_at    timestamptz default now()
);

alter table public.rules_filter enable row level security;
create policy "Users can CRUD own rules filter" on public.rules_filter
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── invite_codes ───────────────────────────────────────────
create table public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  cohort text not null check (cohort in ('alpha','beta','veteran','other')),
  intended_for text,                    -- internal note, e.g. "Braeden - Stackably"
  account_type_grant text not null,     -- value written to profiles.account_type on redemption
  pricing_tier_grant text,              -- e.g. 'lifetime_explorer'
  requires_idme boolean not null default false,
  status text not null default 'unused' check (status in ('unused','redeemed','revoked','expired')),
  redeemed_by uuid references auth.users(id),
  redeemed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index on public.invite_codes (code);
create index on public.invite_codes (status);

alter table public.invite_codes enable row level security;

-- No public select/insert/update/delete policies.
-- All access goes through the redeem_invite_code() RPC below,
-- or through Jason's service-role admin session.

-- Atomic, race-safe redemption — locks the row (`for update`) so two
-- concurrent redemptions of the same code can't both succeed. Veteran
-- cohort (requires_idme) codes are parked at account_type =
-- 'veteran_pending' rather than granted immediately, since ID.me
-- verification isn't built yet.
create or replace function public.redeem_invite_code(
  p_code text,
  p_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row invite_codes%rowtype;
  v_account_type text;
begin
  select * into v_row
  from invite_codes
  where code = p_code
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'invalid_code');
  end if;

  if v_row.status != 'unused' then
    return jsonb_build_object('success', false, 'error', 'code_already_used');
  end if;

  if v_row.expires_at is not null and v_row.expires_at < now() then
    update invite_codes set status = 'expired' where id = v_row.id;
    return jsonb_build_object('success', false, 'error', 'code_expired');
  end if;

  update invite_codes
  set status = 'redeemed',
      redeemed_by = p_user_id,
      redeemed_at = now()
  where id = v_row.id;

  v_account_type := case when v_row.requires_idme then 'veteran_pending' else v_row.account_type_grant end;

  update profiles
  set account_type = v_account_type,
      pricing_tier = v_row.pricing_tier_grant
  where id = p_user_id;

  return jsonb_build_object(
    'success', true,
    'cohort', v_row.cohort,
    'account_type', v_row.account_type_grant,
    'pricing_tier', v_row.pricing_tier_grant,
    'requires_idme', v_row.requires_idme
  );
end;
$$;

revoke all on function public.redeem_invite_code(text, uuid) from public;
grant execute on function public.redeem_invite_code(text, uuid) to authenticated;

-- FF-001 Calendar Intelligence (applied via MCP migration ff001_calendar_intelligence_tables)

create table public.calendar_connections (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  provider       text not null default 'ical' check (provider in ('ical', 'google')),
  ical_url       text,
  label          text,
  is_active      boolean not null default true,
  sync_status    text not null default 'pending' check (sync_status in ('pending', 'ok', 'error')),
  last_synced_at timestamptz,
  last_error     text,
  event_count    integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.calendar_connections enable row level security;
create policy "own_calendar_connections" on public.calendar_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.calendar_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  connection_id uuid not null references public.calendar_connections(id) on delete cascade,
  uid           text,
  summary       text,
  description   text,
  location      text,
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  all_day       boolean not null default false,
  objective_ids uuid[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on public.calendar_events (user_id);
create index on public.calendar_events (connection_id);
create index on public.calendar_events (starts_at);

alter table public.calendar_events enable row level security;
create policy "own_calendar_events" on public.calendar_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── tutorial_views increment (self-limiting, race-safe) ────
create or replace function public.increment_tutorial_views(uid uuid)
returns void
language sql
security invoker
as $$
  update public.profiles
  set tutorial_views_count = tutorial_views_count + 1
  where id = uid
    and tutorial_views_count < 2;
$$;

grant execute on function public.increment_tutorial_views(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Pre-launch signups (migration: create_prelaunch_signups)
-- ---------------------------------------------------------------------------
create table public.prelaunch_signups (
  id         uuid        primary key default gen_random_uuid(),
  email      text        not null,
  source     text        not null default 'landing_home',
  created_at timestamptz not null default now()
);

create unique index prelaunch_signups_email_lower_idx
  on public.prelaunch_signups (lower(email));

alter table public.prelaunch_signups enable row level security;

-- Anyone (anon) can insert — used by /api/prelaunch (anon client, never service role)
create policy "prelaunch_insert_public"
  on public.prelaunch_signups
  for insert
  with check (true);

-- Only the founder can read rows
create policy "prelaunch_read_founder"
  on public.prelaunch_signups
  for select
  using (auth.uid() = '817b615a-c2c5-4285-8763-bdea3e171e2d'::uuid);
