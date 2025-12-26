-- Criar tabela de relacionamento entre membros e funis
CREATE TABLE public.team_member_funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  funnel_id UUID NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_member_id, funnel_id)
);

-- Habilitar RLS
ALTER TABLE public.team_member_funnels ENABLE ROW LEVEL SECURITY;

-- Policy: Admins da organização podem gerenciar funis dos membros
CREATE POLICY "Admins can manage member funnels"
ON public.team_member_funnels FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.id = team_member_funnels.team_member_id
    AND is_org_admin(auth.uid(), tm.organization_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.id = team_member_funnels.team_member_id
    AND is_org_admin(auth.uid(), tm.organization_id)
  )
);

-- Policy: Membros podem ver seus próprios funis
CREATE POLICY "Members can view their own funnels"
ON public.team_member_funnels FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.id = team_member_funnels.team_member_id
    AND tm.user_id = auth.uid()
  )
);

-- Criar função para buscar funnel_ids do membro atual
CREATE OR REPLACE FUNCTION public.get_member_funnel_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tmf.funnel_id
  FROM team_member_funnels tmf
  JOIN team_members tm ON tm.id = tmf.team_member_id
  WHERE tm.user_id = _user_id AND tm.status = 'active'
$$;

-- Criar função para verificar se membro tem restrição de funis
CREATE OR REPLACE FUNCTION public.member_has_funnel_restriction(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM team_member_funnels tmf
    JOIN team_members tm ON tm.id = tmf.team_member_id
    WHERE tm.user_id = _user_id AND tm.status = 'active'
  )
$$;