-- Weekly check-in steps 4–5: confidence_flag and feature_tags
-- Both columns were already present from a prior migration.
-- ADD COLUMN IF NOT EXISTS is a safe no-op when the column exists —
-- Postgres skips the entire statement, so the CHECK constraint is not
-- applied retroactively (one existing row has confidence_flag='none').
-- Future rows are constrained at the application layer.

ALTER TABLE public.user_reflections
  ADD COLUMN IF NOT EXISTS confidence_flag text
    CHECK (confidence_flag IN ('behind', 'uncertain', 'on_track', 'ahead'));

ALTER TABLE public.user_reflections
  ADD COLUMN IF NOT EXISTS feature_tags text[] DEFAULT '{}';
