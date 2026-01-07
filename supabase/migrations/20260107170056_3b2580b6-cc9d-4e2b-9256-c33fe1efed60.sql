-- Função helper para verificar se usuário é admin da organização do dono da instância
CREATE OR REPLACE FUNCTION public.is_instance_org_admin(_user_id uuid, _instance_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    -- Busca a organização do dono da instância e verifica se o usuário é admin dessa org
    SELECT 1 
    FROM public.team_members tm_instance
    JOIN public.team_members tm_user ON tm_instance.organization_id = tm_user.organization_id
    WHERE tm_instance.user_id = _instance_user_id
      AND tm_instance.status = 'active'
      AND tm_user.user_id = _user_id
      AND tm_user.status = 'active'
      AND tm_user.role IN ('admin', 'owner')
  )
  OR EXISTS (
    -- Também verifica se o usuário é owner da organização
    SELECT 1
    FROM public.team_members tm
    JOIN public.organizations o ON tm.organization_id = o.id
    WHERE tm.user_id = _instance_user_id
      AND tm.status = 'active'
      AND o.owner_id = _user_id
  )
$$;

-- Atualizar política de UPDATE
DROP POLICY IF EXISTS "Users can update their own instances" ON whatsapp_instances;

CREATE POLICY "Users can update own or org admin instances"
ON whatsapp_instances
FOR UPDATE
USING (
  auth.uid() = user_id 
  OR public.is_instance_org_admin(auth.uid(), user_id)
)
WITH CHECK (
  auth.uid() = user_id 
  OR public.is_instance_org_admin(auth.uid(), user_id)
);

-- Atualizar política de DELETE
DROP POLICY IF EXISTS "Users can delete their own instances" ON whatsapp_instances;

CREATE POLICY "Users can delete own or org admin instances"
ON whatsapp_instances
FOR DELETE
USING (
  auth.uid() = user_id 
  OR public.is_instance_org_admin(auth.uid(), user_id)
);