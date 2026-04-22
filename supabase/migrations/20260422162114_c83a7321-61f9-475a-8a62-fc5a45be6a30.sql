
CREATE POLICY "System owners can view all whatsapp instances"
ON public.whatsapp_instances
FOR SELECT
TO authenticated
USING (public.is_system_owner(auth.uid()));

CREATE POLICY "System owners can view all meta numbers"
ON public.meta_whatsapp_numbers
FOR SELECT
TO authenticated
USING (public.is_system_owner(auth.uid()));
