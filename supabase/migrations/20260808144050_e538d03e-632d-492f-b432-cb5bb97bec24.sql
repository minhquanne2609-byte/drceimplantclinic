CREATE TABLE public.saved_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  patient_name text,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '21 days'
);

GRANT SELECT, INSERT, UPDATE ON public.saved_plans TO anon, authenticated;
GRANT ALL ON public.saved_plans TO service_role;

ALTER TABLE public.saved_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view non-expired plans"
  ON public.saved_plans FOR SELECT
  USING (expires_at > now());

CREATE POLICY "Anyone can create plans"
  ON public.saved_plans FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update non-expired plans"
  ON public.saved_plans FOR UPDATE
  USING (expires_at > now())
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.saved_plans_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.expires_at = now() + interval '21 days';
  RETURN NEW;
END;
$$;

CREATE TRIGGER saved_plans_touch_trigger
BEFORE UPDATE ON public.saved_plans
FOR EACH ROW EXECUTE FUNCTION public.saved_plans_touch();

CREATE INDEX saved_plans_updated_at_idx ON public.saved_plans (updated_at DESC);

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'purge-expired-saved-plans',
  '0 3 * * *',
  $$DELETE FROM public.saved_plans WHERE expires_at < now()$$
);