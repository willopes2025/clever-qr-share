CREATE POLICY "Users can update form submissions"
ON public.form_submissions FOR UPDATE
USING (user_id IN (SELECT get_organization_member_ids(auth.uid())))
WITH CHECK (user_id IN (SELECT get_organization_member_ids(auth.uid())));