
CREATE POLICY "creators can delete own email channels"
ON public.email_channels
FOR DELETE
TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "creators can update own email channels"
ON public.email_channels
FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());
