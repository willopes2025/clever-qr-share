
-- Drop existing problematic policies on team_members
DROP POLICY IF EXISTS "Members can view team members in their org" ON public.team_members;
DROP POLICY IF EXISTS "Admins can insert team members" ON public.team_members;
DROP POLICY IF EXISTS "Admins can update team members" ON public.team_members;
DROP POLICY IF EXISTS "Admins can delete team members" ON public.team_members;
DROP POLICY IF EXISTS "Team members can view their organization" ON public.team_members;
DROP POLICY IF EXISTS "Users can view their own team membership" ON public.team_members;

-- Drop existing problematic policy on organizations
DROP POLICY IF EXISTS "Users can view their organization" ON public.organizations;

-- Create security definer function to check if user is org admin/owner
CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations WHERE id = _org_id AND owner_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.team_members 
    WHERE organization_id = _org_id 
    AND user_id = _user_id 
    AND role IN ('admin', 'owner')
    AND status = 'active'
  )
$$;

-- Create security definer function to check if user belongs to org
CREATE OR REPLACE FUNCTION public.user_belongs_to_org(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations WHERE id = _org_id AND owner_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.team_members 
    WHERE organization_id = _org_id 
    AND user_id = _user_id 
    AND status = 'active'
  )
$$;

-- Recreate policies for organizations table
CREATE POLICY "Users can view their organization"
ON public.organizations FOR SELECT
USING (
  owner_id = auth.uid() 
  OR public.user_belongs_to_org(auth.uid(), id)
);

-- Recreate policies for team_members table
CREATE POLICY "Users can view team members in their org"
ON public.team_members FOR SELECT
USING (
  public.user_belongs_to_org(auth.uid(), organization_id)
);

CREATE POLICY "Admins can insert team members"
ON public.team_members FOR INSERT
WITH CHECK (
  public.is_org_admin(auth.uid(), organization_id)
);

CREATE POLICY "Admins can update team members"
ON public.team_members FOR UPDATE
USING (
  public.is_org_admin(auth.uid(), organization_id)
);

CREATE POLICY "Admins can delete team members"
ON public.team_members FOR DELETE
USING (
  public.is_org_admin(auth.uid(), organization_id)
);
