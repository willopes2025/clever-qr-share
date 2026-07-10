DROP POLICY IF EXISTS "Anyone can read short links by code" ON public.form_short_links;

REVOKE SELECT ON public.form_short_links FROM anon;

CREATE POLICY "Org members can read short links"
  ON public.form_short_links FOR SELECT
  TO authenticated
  USING (
    shared_by_user_id IN (SELECT public.get_organization_member_ids(auth.uid()))
  );