-- user_roles: needed for owner/admin checks (is_content_manager, has_role)
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- clinic_content: public read of active defaults, authenticated owner/admin edits
GRANT SELECT ON public.clinic_content TO anon;
GRANT SELECT, INSERT, UPDATE ON public.clinic_content TO authenticated;
GRANT ALL ON public.clinic_content TO service_role;