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
  onboarded_at  timestamptz,
  sweep_count   int default 0,
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
  section_c     jsonb,
  section_d     jsonb,
  section_e     text,
  section_f     text,
  section_g     text,
  section_h_rating int,
  section_h_notes text,
  is_complete   boolean default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
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
