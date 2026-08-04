-- Add started_at and completed_at to bulk_sweep_job_accounts.
-- started_at is set by process-account-queue when marking an account running.
-- Used by the watchdog reaper in process-scheduled to identify stuck invocations.
ALTER TABLE public.bulk_sweep_job_accounts
  ADD COLUMN IF NOT EXISTS started_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
