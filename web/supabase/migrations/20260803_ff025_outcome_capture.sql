-- FF-025: Outcome Capture
-- Stores what happened when a user marks an objective complete.
-- Engine 4 (FF-002) reads this table for calibration anchors.

CREATE TABLE IF NOT EXISTS public.objective_outcomes (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  objective_id        UUID        NOT NULL REFERENCES public.objectives(id) ON DELETE CASCADE,
  recorded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  outcome_type        TEXT        NOT NULL CHECK (outcome_type IN ('HIT', 'PARTIAL', 'MISS')),
  outcome_note        TEXT,
  actual_completed_at DATE,
  swept_at_close      INTEGER,    -- confidence score 0-100 at moment of completion (Engine 4 calibration anchor)
  prediction_id       UUID        REFERENCES public.predictions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_obj_outcomes_objective_id
  ON public.objective_outcomes(objective_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_obj_outcomes_user_id
  ON public.objective_outcomes(user_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_obj_outcomes_prediction_id
  ON public.objective_outcomes(prediction_id) WHERE prediction_id IS NOT NULL;

ALTER TABLE public.objective_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own outcomes" ON public.objective_outcomes;
CREATE POLICY "Users see own outcomes"
  ON public.objective_outcomes FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own outcomes" ON public.objective_outcomes;
CREATE POLICY "Users insert own outcomes"
  ON public.objective_outcomes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Conditional: add objective_id to predictions if missing.
-- As of FF-025 ground truth (2026-08-03), this column already exists — block no-ops cleanly.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'predictions' AND column_name = 'objective_id'
  ) THEN
    ALTER TABLE public.predictions
      ADD COLUMN objective_id UUID REFERENCES public.objectives(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_predictions_objective_id
      ON public.predictions(objective_id) WHERE objective_id IS NOT NULL;
  END IF;
END $$;
