-- =============================================
-- Fix RLS Policies for Multi-Tenant Organization Access
-- =============================================

-- 1. Update funnel_stages policies
DROP POLICY IF EXISTS "Users can view stages of their funnels" ON funnel_stages;
CREATE POLICY "Users can view organization stages" ON funnel_stages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM funnels
    WHERE funnels.id = funnel_stages.funnel_id
    AND (funnels.user_id = auth.uid() OR funnels.user_id IN (SELECT get_organization_member_ids(auth.uid())))
  )
);

DROP POLICY IF EXISTS "Users can update stages in their funnels" ON funnel_stages;
CREATE POLICY "Users can update organization stages" ON funnel_stages
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM funnels
    WHERE funnels.id = funnel_stages.funnel_id
    AND (funnels.user_id = auth.uid() OR funnels.user_id IN (SELECT get_organization_member_ids(auth.uid())))
  )
);

DROP POLICY IF EXISTS "Users can delete stages in their funnels" ON funnel_stages;
CREATE POLICY "Users can delete organization stages" ON funnel_stages
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM funnels
    WHERE funnels.id = funnel_stages.funnel_id
    AND (funnels.user_id = auth.uid() OR funnels.user_id IN (SELECT get_organization_member_ids(auth.uid())))
  )
);

-- 2. Update funnel_close_reasons policies
DROP POLICY IF EXISTS "Users can view their own close reasons" ON funnel_close_reasons;
CREATE POLICY "Users can view organization close reasons" ON funnel_close_reasons
FOR SELECT USING (
  user_id = auth.uid() OR user_id IN (SELECT get_organization_member_ids(auth.uid()))
);

DROP POLICY IF EXISTS "Users can update their own close reasons" ON funnel_close_reasons;
CREATE POLICY "Users can update organization close reasons" ON funnel_close_reasons
FOR UPDATE USING (
  user_id = auth.uid() OR user_id IN (SELECT get_organization_member_ids(auth.uid()))
);

DROP POLICY IF EXISTS "Users can delete their own close reasons" ON funnel_close_reasons;
CREATE POLICY "Users can delete organization close reasons" ON funnel_close_reasons
FOR DELETE USING (
  user_id = auth.uid() OR user_id IN (SELECT get_organization_member_ids(auth.uid()))
);

-- 3. Update funnel_automations policies
DROP POLICY IF EXISTS "Users can view their own automations" ON funnel_automations;
CREATE POLICY "Users can view organization automations" ON funnel_automations
FOR SELECT USING (
  user_id = auth.uid() OR user_id IN (SELECT get_organization_member_ids(auth.uid()))
);

DROP POLICY IF EXISTS "Users can update their own automations" ON funnel_automations;
CREATE POLICY "Users can update organization automations" ON funnel_automations
FOR UPDATE USING (
  user_id = auth.uid() OR user_id IN (SELECT get_organization_member_ids(auth.uid()))
);

DROP POLICY IF EXISTS "Users can delete their own automations" ON funnel_automations;
CREATE POLICY "Users can delete organization automations" ON funnel_automations
FOR DELETE USING (
  user_id = auth.uid() OR user_id IN (SELECT get_organization_member_ids(auth.uid()))
);