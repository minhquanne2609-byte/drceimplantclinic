GRANT EXECUTE ON FUNCTION public.is_content_manager(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_content_manager(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon;