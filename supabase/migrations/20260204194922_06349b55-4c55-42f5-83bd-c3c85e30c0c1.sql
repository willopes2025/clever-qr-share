-- 1. funnel_deal_history - DROP e CREATE novas políticas
DROP POLICY IF EXISTS "Users can create history for their deals" ON funnel_deal_history;
DROP POLICY IF EXISTS "Users can view history of their deals" ON funnel_deal_history;

CREATE POLICY "Org members can create history for org deals" ON funnel_deal_history
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM funnel_deals
  WHERE funnel_deals.id = funnel_deal_history.deal_id 
  AND (funnel_deals.user_id = auth.uid() 
       OR funnel_deals.user_id IN (SELECT get_organization_member_ids(auth.uid())))
));

CREATE POLICY "Org members can view history of org deals" ON funnel_deal_history
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM funnel_deals
  WHERE funnel_deals.id = funnel_deal_history.deal_id 
  AND (funnel_deals.user_id = auth.uid() 
       OR funnel_deals.user_id IN (SELECT get_organization_member_ids(auth.uid())))
));

-- 2. funnel_deals - UPDATE e DELETE
DROP POLICY IF EXISTS "Users can update their own deals" ON funnel_deals;
DROP POLICY IF EXISTS "Users can delete their own deals" ON funnel_deals;

CREATE POLICY "Org members can update org deals" ON funnel_deals
FOR UPDATE TO authenticated
USING (user_id = auth.uid() 
       OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

CREATE POLICY "Org members can delete org deals" ON funnel_deals
FOR DELETE TO authenticated
USING (user_id = auth.uid() 
       OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- 3. funnel_stages - INSERT
DROP POLICY IF EXISTS "Users can create stages in their funnels" ON funnel_stages;

CREATE POLICY "Org members can create stages in org funnels" ON funnel_stages
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM funnels
  WHERE funnels.id = funnel_stages.funnel_id 
  AND (funnels.user_id = auth.uid() 
       OR funnels.user_id IN (SELECT get_organization_member_ids(auth.uid())))
));