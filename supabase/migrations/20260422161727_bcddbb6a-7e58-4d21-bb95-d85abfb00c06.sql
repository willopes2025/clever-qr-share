CREATE POLICY "System owners can view all organizations"
ON public.organizations
FOR SELECT
TO authenticated
USING (public.is_system_owner(auth.uid()));