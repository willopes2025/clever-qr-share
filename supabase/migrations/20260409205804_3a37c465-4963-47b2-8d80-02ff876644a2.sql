
-- Fix deal_tasks UPDATE policy to allow organization members
DROP POLICY "Users can update their own deal tasks" ON public.deal_tasks;
CREATE POLICY "Users can update organization deal tasks"
ON public.deal_tasks
FOR UPDATE
USING (user_id IN (SELECT get_organization_member_ids(auth.uid())))
WITH CHECK (user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- Fix deal_tasks DELETE policy to allow organization members
DROP POLICY "Users can delete their own deal tasks" ON public.deal_tasks;
CREATE POLICY "Users can delete organization deal tasks"
ON public.deal_tasks
FOR DELETE
USING (user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- Fix deal_tasks INSERT policy to allow organization context
DROP POLICY "Users can create their own deal tasks" ON public.deal_tasks;
CREATE POLICY "Users can create deal tasks"
ON public.deal_tasks
FOR INSERT
WITH CHECK (auth.uid() = user_id);
