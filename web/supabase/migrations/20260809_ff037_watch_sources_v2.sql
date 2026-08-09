-- FF-037 Step 2 addendum: URL confidence flag
ALTER TABLE public.watch_sources ADD COLUMN requires_confirmation bool NOT NULL DEFAULT false;
