-- FF-032: Objective State Evolution — change-log table
-- Timestamped record of every edit to tracked objective fields.
-- Written by the application layer (not triggers) on every PATCH to objectives.

CREATE TABLE IF NOT EXISTS public.objective_changes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  objective_id  UUID NOT NULL REFERENCES public.objectives(id) ON DELETE CASCADE,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_field TEXT NOT NULL,        -- 'title' | 'context' | 'target_date' | 'notes'
  old_value     TEXT,
  new_value     TEXT,
  change_source TEXT NOT NULL DEFAULT 'user_edit'  -- 'user_edit' | 'system' (future)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_obj_changes_objective_id
  ON public.objective_changes(objective_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_obj_changes_user_id
  ON public.objective_changes(user_id, changed_at DESC);

-- RLS
ALTER TABLE public.objective_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own changes" ON public.objective_changes;
CREATE POLICY "Users see own changes"
  ON public.objective_changes FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own changes" ON public.objective_changes;
CREATE POLICY "Users insert own changes"
  ON public.objective_changes FOR INSERT
  WITH CHECK (auth.uid() = user_id);
