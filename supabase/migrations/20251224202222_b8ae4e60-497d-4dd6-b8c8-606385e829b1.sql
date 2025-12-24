-- Remove the recursive policy that causes infinite recursion
DROP POLICY IF EXISTS "Members can view their team" ON public.team_members;

-- Ensure we have proper non-recursive policies using security definer functions
-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can view team members" ON public.team_members;
DROP POLICY IF EXISTS "Admins can insert team members" ON public.team_members;
DROP POLICY IF EXISTS "Admins can update team members" ON public.team_members;
DROP POLICY IF EXISTS "Admins can delete team members" ON public.team_members;

-- Create proper RLS policies using security definer functions
CREATE POLICY "Users can view team members"
ON public.team_members
FOR SELECT
TO authenticated
USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Admins can insert team members"
ON public.team_members
FOR INSERT
TO authenticated
WITH CHECK (is_org_admin(organization_id, auth.uid()));

CREATE POLICY "Admins can update team members"
ON public.team_members
FOR UPDATE
TO authenticated
USING (is_org_admin(organization_id, auth.uid()));

CREATE POLICY "Admins can delete team members"
ON public.team_members
FOR DELETE
TO authenticated
USING (is_org_admin(organization_id, auth.uid()));