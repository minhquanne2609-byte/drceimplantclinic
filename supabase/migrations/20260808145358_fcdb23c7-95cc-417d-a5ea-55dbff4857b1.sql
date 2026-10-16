GRANT DELETE ON public.saved_plans TO authenticated;
CREATE POLICY "Signed-in users can delete plans"
ON public.saved_plans FOR DELETE TO authenticated USING (true);