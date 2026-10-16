CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'staff');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_content_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('owner', 'admin')
  )
$$;

CREATE TABLE public.clinic_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_key text NOT NULL,
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (content_key, version)
);

CREATE UNIQUE INDEX clinic_content_active_key
  ON public.clinic_content (content_key) WHERE is_active;

GRANT SELECT ON public.clinic_content TO anon;
GRANT SELECT, INSERT, UPDATE ON public.clinic_content TO authenticated;
GRANT ALL ON public.clinic_content TO service_role;
ALTER TABLE public.clinic_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active clinic content is publicly readable"
  ON public.clinic_content FOR SELECT TO anon, authenticated
  USING (is_active);

CREATE POLICY "Content managers can read every version"
  ON public.clinic_content FOR SELECT TO authenticated
  USING (public.is_content_manager(auth.uid()));

CREATE POLICY "Content managers can add versions"
  ON public.clinic_content FOR INSERT TO authenticated
  WITH CHECK (public.is_content_manager(auth.uid()) AND updated_by = auth.uid());

CREATE POLICY "Content managers can update versions"
  ON public.clinic_content FOR UPDATE TO authenticated
  USING (public.is_content_manager(auth.uid()))
  WITH CHECK (public.is_content_manager(auth.uid()));

CREATE OR REPLACE FUNCTION public.clinic_content_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER clinic_content_touch_trigger
BEFORE UPDATE ON public.clinic_content
FOR EACH ROW EXECUTE FUNCTION public.clinic_content_touch();