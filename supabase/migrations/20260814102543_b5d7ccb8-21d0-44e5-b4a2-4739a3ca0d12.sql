ALTER TABLE public.clinic_content
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'rich',
  ADD COLUMN IF NOT EXISTS content_value jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE POLICY "Clinic media is readable"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'clinic-media');

CREATE POLICY "Content managers can upload clinic media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'clinic-media' AND public.is_content_manager(auth.uid()));

CREATE POLICY "Content managers can update clinic media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'clinic-media' AND public.is_content_manager(auth.uid()))
WITH CHECK (bucket_id = 'clinic-media' AND public.is_content_manager(auth.uid()));

CREATE POLICY "Content managers can delete clinic media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'clinic-media' AND public.is_content_manager(auth.uid()));