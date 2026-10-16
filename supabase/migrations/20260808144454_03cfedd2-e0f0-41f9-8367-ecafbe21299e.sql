DROP POLICY IF EXISTS "Anyone can view non-expired plans" ON public.saved_plans;
DROP POLICY IF EXISTS "Anyone can create plans" ON public.saved_plans;
DROP POLICY IF EXISTS "Anyone can update non-expired plans" ON public.saved_plans;

REVOKE ALL ON public.saved_plans FROM anon;

GRANT SELECT, INSERT, UPDATE ON public.saved_plans TO authenticated;
GRANT ALL ON public.saved_plans TO service_role;

CREATE POLICY "Signed-in users can view non-expired plans"
  ON public.saved_plans FOR SELECT
  TO authenticated
  USING (expires_at > now());

CREATE POLICY "Signed-in users can create plans"
  ON public.saved_plans FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Signed-in users can update non-expired plans"
  ON public.saved_plans FOR UPDATE
  TO authenticated
  USING (expires_at > now())
  WITH CHECK (true);