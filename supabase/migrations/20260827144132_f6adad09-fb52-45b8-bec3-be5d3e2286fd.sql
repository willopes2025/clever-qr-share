DROP POLICY IF EXISTS "Admins and owners can manage vendedores" ON public.gestao_parts_vendedores;

CREATE POLICY "Admins and owners can manage vendedores"
ON public.gestao_parts_vendedores
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_system_owner(auth.uid())
  OR public.get_user_team_role(auth.uid()) = ANY (ARRAY['owner','admin'])
  OR EXISTS (SELECT 1 FROM public.organizations o WHERE o.owner_id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_system_owner(auth.uid())
  OR public.get_user_team_role(auth.uid()) = ANY (ARRAY['owner','admin'])
  OR EXISTS (SELECT 1 FROM public.organizations o WHERE o.owner_id = auth.uid())
);