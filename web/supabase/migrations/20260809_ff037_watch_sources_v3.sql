-- FF-037 v3: add last_error column to watch_sources for per-source fetch/parse error tracking
ALTER TABLE public.watch_sources ADD COLUMN last_error text;
