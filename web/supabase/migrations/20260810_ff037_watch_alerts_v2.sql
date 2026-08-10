-- FF-037: Add triggered_by_url to watch_alerts so dual-URL checks can
-- record which URL (url_provided vs url_resolved) fired the alert.
ALTER TABLE public.watch_alerts
  ADD COLUMN IF NOT EXISTS triggered_by_url text;
