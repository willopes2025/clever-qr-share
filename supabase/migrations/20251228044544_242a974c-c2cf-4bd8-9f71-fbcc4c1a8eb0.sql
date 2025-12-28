-- Atualizar função get_organization_member_ids para incluir o próprio usuário
CREATE OR REPLACE FUNCTION public.get_organization_member_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Incluir o próprio usuário
  SELECT _user_id
  
  UNION
  
  -- Membros da mesma organização via team_members
  SELECT DISTINCT tm2.user_id
  FROM public.team_members tm1
  JOIN public.team_members tm2 ON tm1.organization_id = tm2.organization_id
  WHERE tm1.user_id = _user_id 
    AND tm1.status = 'active'
    AND tm2.status = 'active'
    AND tm2.user_id IS NOT NULL
  
  UNION
  
  -- Incluir user_ids de organizações onde o usuário é owner
  SELECT DISTINCT tm.user_id
  FROM public.organizations o
  JOIN public.team_members tm ON tm.organization_id = o.id
  WHERE o.owner_id = _user_id
    AND tm.status = 'active'
    AND tm.user_id IS NOT NULL
  
  UNION
  
  -- Incluir o próprio owner_id das organizações onde o usuário é membro
  SELECT DISTINCT o.owner_id
  FROM public.team_members tm
  JOIN public.organizations o ON tm.organization_id = o.id
  WHERE tm.user_id = _user_id
    AND tm.status = 'active'
$$;