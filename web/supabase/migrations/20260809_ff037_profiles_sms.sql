-- FF-037 Step 8: SMS alert opt-in on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sms_alerts_enabled bool NOT NULL DEFAULT false;
