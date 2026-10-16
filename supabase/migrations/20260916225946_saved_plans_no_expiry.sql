-- Saved treatment plans used to expire (and get purged) 21 days after their
-- last save (see 20260808144050_e538d03e-632d-492f-b432-cb5bb97bec24.sql).
-- The clinic now wants plans kept indefinitely, so the auto-expiry is
-- effectively disabled here instead of removed outright: the expires_at
-- column, its NOT NULL constraint and the "expires_at > now()" RLS checks
-- are all left exactly as they are (touching those would be a much bigger,
-- riskier change), and the "in 21 days" values are just replaced with an
-- "in 100 years" value that, in practice, never expires.

-- New plans: default expiry pushed out to effectively never.
ALTER TABLE public.saved_plans
  ALTER COLUMN expires_at SET DEFAULT now() + interval '100 years';

-- Existing plans: give them the same long runway so none of them lapse
-- under the old 21-day value before their next save.
UPDATE public.saved_plans
SET expires_at = now() + interval '100 years'
WHERE expires_at < now() + interval '100 years';

-- Every future save (the saved_plans_touch trigger fires on every UPDATE)
-- renews expires_at by 100 years instead of 21 days.
CREATE OR REPLACE FUNCTION public.saved_plans_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.expires_at = now() + interval '100 years';
  RETURN NEW;
END;
$$;

-- The nightly purge job would only ever delete rows past their (now
-- effectively never-reached) expires_at, so it's harmless to leave
-- scheduled — but it's dead weight with nothing left for it to do, so it's
-- unscheduled for clarity.
SELECT cron.unschedule('purge-expired-saved-plans');
