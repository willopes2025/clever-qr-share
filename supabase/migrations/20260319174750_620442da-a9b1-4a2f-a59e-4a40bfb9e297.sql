-- Permitir que admins/owners da mesma organização possam cancelar/atualizar campanhas de outros membros da equipe
CREATE POLICY "Organization admins can update organization campaigns"
ON public.campaigns
FOR UPDATE
TO authenticated
USING (
  public.is_instance_org_admin(auth.uid(), user_id)
)
WITH CHECK (
  public.is_instance_org_admin(auth.uid(), user_id)
);