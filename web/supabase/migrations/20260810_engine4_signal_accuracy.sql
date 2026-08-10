-- Engine 4 — Signal Accuracy Engine
-- Migration: 20260810_engine4_signal_accuracy
-- Tables: signal_class_accuracy, prediction_scores
-- Alters: signals (signal_class constraint), sweeps (signal_class_weights), predictions (status)

-- ─── Table 1: signal_class_accuracy ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS signal_class_accuracy (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  objective_domain  text        NOT NULL,
  signal_class      text        NOT NULL CHECK (signal_class IN ('news', 'market', 'dependency', 'user_action', 'watch_source')),
  outcomes_scored   int2        NOT NULL DEFAULT 0,
  accuracy_sum      numeric     NOT NULL DEFAULT 0,
  accuracy_avg      numeric     GENERATED ALWAYS AS (
    CASE WHEN outcomes_scored > 0 THEN accuracy_sum / outcomes_scored ELSE NULL END
  ) STORED,
  weight_modifier   numeric     NOT NULL DEFAULT 1.0,
  last_updated_at   timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, objective_domain, signal_class)
);

ALTER TABLE signal_class_accuracy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own accuracy rows" ON signal_class_accuracy
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_signal_class_accuracy_user_domain
  ON signal_class_accuracy (user_id, objective_domain);

-- ─── Table 2: prediction_scores ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prediction_scores (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  prediction_id         uuid        NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  outcome_id            uuid        REFERENCES objective_outcomes(id) ON DELETE SET NULL,
  predicted_confidence  int2        NOT NULL,
  actual_outcome        text        NOT NULL CHECK (actual_outcome IN ('success', 'partial', 'failed')),
  accuracy_score        numeric     NOT NULL,
  scoring_method        text        NOT NULL DEFAULT 'auto' CHECK (scoring_method IN ('auto', 'manual')),
  scored_at             timestamptz NOT NULL DEFAULT now(),
  notes                 text
);

ALTER TABLE prediction_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own prediction scores" ON prediction_scores
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_prediction_scores_prediction_id
  ON prediction_scores (prediction_id);

CREATE INDEX IF NOT EXISTS idx_prediction_scores_user_id
  ON prediction_scores (user_id, scored_at DESC);

-- ─── Alter: signals — upgrade signal_class constraint ─────────────────────────
-- signals.signal_class already exists from a prior session. The old constraint
-- included 'internal' (legacy sweep class) and lacked 'watch_source'. This
-- reclassifies legacy rows and swaps the constraint to the Engine 4 enum.
ALTER TABLE signals
  ADD COLUMN IF NOT EXISTS signal_class text DEFAULT 'news';

UPDATE signals SET signal_class = 'news' WHERE signal_class IS NULL;
UPDATE signals SET signal_class = 'market' WHERE signal_class = 'internal';

ALTER TABLE signals DROP CONSTRAINT IF EXISTS signals_signal_class_check;
ALTER TABLE signals ADD CONSTRAINT signals_signal_class_check
  CHECK (signal_class IN ('news', 'market', 'dependency', 'user_action', 'watch_source'));

-- ─── Alter: sweeps — add signal_class_weights ─────────────────────────────────
ALTER TABLE sweeps
  ADD COLUMN IF NOT EXISTS signal_class_weights jsonb;

-- ─── Alter: predictions — add status for Engine 4 cron ───────────────────────
-- 'active' = open prediction, eligible for auto-scoring at horizon
-- 'scored' = Engine 4 has written a prediction_scores row
-- 'cancelled' = manually voided
ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'scored', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_predictions_status_horizon
  ON predictions (status, horizon_date)
  WHERE status = 'active';
