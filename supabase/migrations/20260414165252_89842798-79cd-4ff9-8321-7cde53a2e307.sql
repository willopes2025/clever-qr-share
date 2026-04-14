
-- Fix SELECT policy to include org members
DROP POLICY IF EXISTS "Users can view their campaign messages" ON public.campaign_messages;
CREATE POLICY "Users can view their campaign messages"
ON public.campaign_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM campaigns
    WHERE campaigns.id = campaign_messages.campaign_id
    AND (campaigns.user_id = auth.uid() OR campaigns.user_id IN (SELECT get_organization_member_ids(auth.uid())))
  )
);

-- Fix UPDATE policy to include org members
DROP POLICY IF EXISTS "Users can update their campaign messages" ON public.campaign_messages;
CREATE POLICY "Users can update their campaign messages"
ON public.campaign_messages FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM campaigns
    WHERE campaigns.id = campaign_messages.campaign_id
    AND (campaigns.user_id = auth.uid() OR campaigns.user_id IN (SELECT get_organization_member_ids(auth.uid())))
  )
);

-- Fix INSERT policy to include org members
DROP POLICY IF EXISTS "Users can insert their campaign messages" ON public.campaign_messages;
CREATE POLICY "Users can insert their campaign messages"
ON public.campaign_messages FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM campaigns
    WHERE campaigns.id = campaign_messages.campaign_id
    AND (campaigns.user_id = auth.uid() OR campaigns.user_id IN (SELECT get_organization_member_ids(auth.uid())))
  )
);
