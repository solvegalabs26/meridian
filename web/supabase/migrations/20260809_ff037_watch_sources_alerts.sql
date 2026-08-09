-- ============================================================
-- FF-037: Intelligent URL Watchlist & Time-Sensitive Alert Engine
-- Tables: watch_sources, watch_alerts
-- ============================================================

-- ---------------------
-- TABLE: watch_sources
-- ---------------------
CREATE TABLE public.watch_sources (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  objective_id      uuid        REFERENCES public.objectives(id) ON DELETE CASCADE,
  url_provided      text        NOT NULL,
  url_resolved      text,
  url_resolved_at   timestamptz,
  priority_tier     int2        NOT NULL DEFAULT 2,
  watch_type        text        NOT NULL DEFAULT 'custom',
  target_signal     text,
  last_hash         text,
  last_checked_at   timestamptz,
  last_state        text        NOT NULL DEFAULT 'no_signal',
  alert_fired_at    timestamptz,
  is_active         bool        NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT watch_sources_priority_tier_check
    CHECK (priority_tier IN (1, 2, 3)),
  CONSTRAINT watch_sources_watch_type_check
    CHECK (watch_type IN ('careers_listing', 'registration', 'status_page', 'custom')),
  CONSTRAINT watch_sources_last_state_check
    CHECK (last_state IN ('no_signal', 'signal_detected', 'signal_confirmed', 'signal_gone'))
);

ALTER TABLE public.watch_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "watch_sources_user_isolation"
  ON public.watch_sources
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------
-- TABLE: watch_alerts
-- ---------------------
CREATE TABLE public.watch_alerts (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  watch_source_id   uuid        REFERENCES public.watch_sources(id) ON DELETE CASCADE,
  objective_id      uuid        REFERENCES public.objectives(id) ON DELETE CASCADE,
  alert_level       text        NOT NULL,
  signal_summary    text        NOT NULL,
  action_text       text        NOT NULL,
  direct_url        text,
  channels_sent     text[]      NOT NULL DEFAULT '{}',
  user_seen_at      timestamptz,
  user_actioned_at  timestamptz,
  confidence        int2,
  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT watch_alerts_alert_level_check
    CHECK (alert_level IN ('critical', 'high', 'medium'))
);

ALTER TABLE public.watch_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "watch_alerts_user_isolation"
  ON public.watch_alerts
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
