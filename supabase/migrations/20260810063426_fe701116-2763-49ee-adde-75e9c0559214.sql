DROP POLICY IF EXISTS "Signed-in users can create plans" ON public.saved_plans;
DROP POLICY IF EXISTS "Signed-in users can delete plans" ON public.saved_plans;
DROP POLICY IF EXISTS "Signed-in users can update non-expired plans" ON public.saved_plans;
DROP POLICY IF EXISTS "Signed-in users can view non-expired plans" ON public.saved_plans;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_plans TO authenticated;
GRANT ALL ON public.saved_plans TO service_role;

CREATE POLICY "Anyone with the link can view non-expired plans"
  ON public.saved_plans FOR SELECT TO anon, authenticated
  USING (expires_at > now());

CREATE POLICY "Anyone with the link can create plans"
  ON public.saved_plans FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone with the link can update non-expired plans"
  ON public.saved_plans FOR UPDATE TO anon, authenticated
  USING (expires_at > now()) WITH CHECK (true);

CREATE POLICY "Anyone with the link can delete plans"
  ON public.saved_plans FOR DELETE TO anon, authenticated
  USING (true);