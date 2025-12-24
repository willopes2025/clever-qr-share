-- Fix RLS policies for team_members - correct parameter order in is_org_admin calls
-- The function signature is: is_org_admin(_user_id uuid, _org_id uuid)
-- But the policies were calling it as is_org_admin(organization_id, auth.uid()) - WRONG ORDER

DROP POLICY IF EXISTS "Admins can insert team members" ON public.team_members;
DROP POLICY IF EXISTS "Admins can update team members" ON public.team_members;
DROP POLICY IF EXISTS "Admins can delete team members" ON public.team_members;

-- Recreate with correct parameter order: is_org_admin(auth.uid(), organization_id)
CREATE POLICY "Admins can insert team members"
ON public.team_members
FOR INSERT
TO authenticated
WITH CHECK (is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Admins can update team members"
ON public.team_members
FOR UPDATE
TO authenticated
USING (is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Admins can delete team members"
ON public.team_members
FOR DELETE
TO authenticated
USING (is_org_admin(auth.uid(), organization_id));