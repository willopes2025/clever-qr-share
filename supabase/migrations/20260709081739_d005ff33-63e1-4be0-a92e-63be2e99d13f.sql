-- 1) form_short_links table
CREATE TABLE public.form_short_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  slug text NOT NULL,
  static_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  shared_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  click_count integer NOT NULL DEFAULT 0,
  last_click_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_form_short_links_code ON public.form_short_links(code);
CREATE INDEX idx_form_short_links_form ON public.form_short_links(form_id);
CREATE INDEX idx_form_short_links_org ON public.form_short_links(organization_id);
CREATE INDEX idx_form_short_links_shared_by ON public.form_short_links(shared_by_user_id);

-- 2) GRANTs — anon needs SELECT so public visitors can resolve short links
GRANT SELECT ON public.form_short_links TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_short_links TO authenticated;
GRANT ALL ON public.form_short_links TO service_role;

-- 3) RLS
ALTER TABLE public.form_short_links ENABLE ROW LEVEL SECURITY;

-- Public read (needed for redirect resolution)
CREATE POLICY "Anyone can read short links by code"
  ON public.form_short_links FOR SELECT
  USING (true);

-- Org members can create their own
CREATE POLICY "Org members can create short links"
  ON public.form_short_links FOR INSERT
  TO authenticated
  WITH CHECK (
    shared_by_user_id = auth.uid()
    AND organization_id = public.resolve_user_organization_id(auth.uid())
  );

CREATE POLICY "Org members can update their short links"
  ON public.form_short_links FOR UPDATE
  TO authenticated
  USING (
    shared_by_user_id IN (SELECT public.get_organization_member_ids(auth.uid()))
  );

CREATE POLICY "Org members can delete their short links"
  ON public.form_short_links FOR DELETE
  TO authenticated
  USING (
    shared_by_user_id IN (SELECT public.get_organization_member_ids(auth.uid()))
  );

-- 4) Add attribution columns
ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS shared_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_form_submissions_shared_by ON public.form_submissions(shared_by_user_id);

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS first_shared_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_first_shared_by ON public.contacts(first_shared_by_user_id);

-- 5) Click counter (callable by anon; avoids needing UPDATE grant to anon)
CREATE OR REPLACE FUNCTION public.increment_form_short_link_click(_code text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.form_short_links
     SET click_count = click_count + 1,
         last_click_at = now()
   WHERE code = _code;
$$;

GRANT EXECUTE ON FUNCTION public.increment_form_short_link_click(text) TO anon, authenticated;