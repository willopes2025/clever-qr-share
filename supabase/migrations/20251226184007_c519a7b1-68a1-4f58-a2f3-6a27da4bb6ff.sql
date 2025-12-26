-- Create team_member_instances table
CREATE TABLE public.team_member_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_member_id, instance_id)
);

-- Enable RLS
ALTER TABLE public.team_member_instances ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage member instances"
ON public.team_member_instances
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.id = team_member_instances.team_member_id
    AND is_org_admin(auth.uid(), tm.organization_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.id = team_member_instances.team_member_id
    AND is_org_admin(auth.uid(), tm.organization_id)
  )
);

CREATE POLICY "Members can view their own instances"
ON public.team_member_instances
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.id = team_member_instances.team_member_id
    AND tm.user_id = auth.uid()
  )
);

-- Create function to get member's allowed instance IDs
CREATE OR REPLACE FUNCTION public.get_member_instance_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tmi.instance_id
  FROM team_member_instances tmi
  JOIN team_members tm ON tm.id = tmi.team_member_id
  WHERE tm.user_id = _user_id AND tm.status = 'active'
$$;

-- Create function to check if member has instance restriction
CREATE OR REPLACE FUNCTION public.member_has_instance_restriction(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM team_member_instances tmi
    JOIN team_members tm ON tm.id = tmi.team_member_id
    WHERE tm.user_id = _user_id AND tm.status = 'active'
  )
$$;

-- Drop old funnel-based functions and table
DROP FUNCTION IF EXISTS public.get_member_funnel_ids(_user_id uuid);
DROP FUNCTION IF EXISTS public.member_has_funnel_restriction(_user_id uuid);
DROP TABLE IF EXISTS public.team_member_funnels;