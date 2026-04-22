-- Tighten RLS: members see only Meta numbers explicitly assigned to them.
-- Org owners always see their own numbers. System owners keep full visibility.

DROP POLICY IF EXISTS "Users can view org meta numbers" ON public.meta_whatsapp_numbers;

CREATE POLICY "Members view assigned meta numbers"
ON public.meta_whatsapp_numbers
FOR SELECT
TO authenticated
USING (
  -- Próprio dono do número
  auth.uid() = user_id
  OR
  -- Owner da organização vê os números de qualquer membro da sua org
  EXISTS (
    SELECT 1
    FROM public.organizations o
    JOIN public.team_members tm ON tm.organization_id = o.id
    WHERE o.owner_id = auth.uid()
      AND tm.status = 'active'
      AND tm.user_id = public.meta_whatsapp_numbers.user_id
  )
  OR
  -- Membro vê apenas se o número estiver explicitamente atribuído a ele
  id IN (SELECT public.get_member_meta_number_ids(auth.uid()))
);

-- Mesma lógica para whatsapp_instances
DROP POLICY IF EXISTS "Users can view organization instances" ON public.whatsapp_instances;

CREATE POLICY "Members view assigned instances"
ON public.whatsapp_instances
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1
    FROM public.organizations o
    JOIN public.team_members tm ON tm.organization_id = o.id
    WHERE o.owner_id = auth.uid()
      AND tm.status = 'active'
      AND tm.user_id = public.whatsapp_instances.user_id
  )
  OR
  id IN (SELECT public.get_member_instance_ids(auth.uid()))
);