
-- Allow users to delete their own broadcast sends
CREATE POLICY "Users can delete their own broadcast sends"
ON public.broadcast_sends FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Allow users to delete campaign messages for their own campaigns
CREATE POLICY "Users can delete their campaign messages"
ON public.campaign_messages FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM campaigns
    WHERE campaigns.id = campaign_messages.campaign_id
    AND (campaigns.user_id = auth.uid() OR campaigns.user_id IN (SELECT get_organization_member_ids(auth.uid())))
  )
);

-- Also allow org members to delete campaigns they can see
DROP POLICY IF EXISTS "Users can delete their own campaigns" ON public.campaigns;
CREATE POLICY "Users can delete their own campaigns"
ON public.campaigns FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR user_id IN (SELECT get_organization_member_ids(auth.uid())));
