DROP POLICY IF EXISTS "Admins can manage vendedores" ON public.gestao_parts_vendedores;

CREATE POLICY "Admins and owners can manage vendedores"
ON public.gestao_parts_vendedores
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.is_system_owner(auth.uid())
  OR public.get_user_team_role(auth.uid()) IN ('owner', 'admin')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.is_system_owner(auth.uid())
  OR public.get_user_team_role(auth.uid()) IN ('owner', 'admin')
);