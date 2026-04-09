DROP POLICY "Users can update their own tasks" ON public.conversation_tasks;
CREATE POLICY "Users can update organization tasks" ON public.conversation_tasks
FOR UPDATE TO authenticated
USING (user_id IN (SELECT get_organization_member_ids(auth.uid())))
WITH CHECK (user_id IN (SELECT get_organization_member_ids(auth.uid())));

DROP POLICY "Users can delete their own tasks" ON public.conversation_tasks;
CREATE POLICY "Users can delete organization tasks" ON public.conversation_tasks
FOR DELETE TO authenticated
USING (user_id IN (SELECT get_organization_member_ids(auth.uid())));