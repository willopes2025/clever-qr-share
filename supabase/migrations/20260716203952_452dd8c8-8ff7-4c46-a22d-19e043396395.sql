
-- CONTACTS: unir SELECT policies e usar InitPlan
DROP POLICY IF EXISTS "Users can view organization contacts" ON public.contacts;
DROP POLICY IF EXISTS "SDR can view assigned contacts" ON public.contacts;

CREATE POLICY "Users can view accessible contacts"
ON public.contacts
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR user_id IN (SELECT get_organization_member_ids((SELECT auth.uid())))
  OR (
    (SELECT is_sdr((SELECT auth.uid())))
    AND user_id IN (SELECT get_sdr_user_ids_scope((SELECT auth.uid())))
  )
);

DROP POLICY IF EXISTS "Users can update organization contacts" ON public.contacts;
CREATE POLICY "Users can update organization contacts"
ON public.contacts
FOR UPDATE
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR user_id IN (SELECT get_organization_member_ids((SELECT auth.uid())))
);

DROP POLICY IF EXISTS "Users can delete organization contacts" ON public.contacts;
CREATE POLICY "Users can delete organization contacts"
ON public.contacts
FOR DELETE
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR user_id IN (SELECT get_organization_member_ids((SELECT auth.uid())))
);

-- CONVERSATIONS: unir SELECT policies e usar InitPlan
DROP POLICY IF EXISTS "Users can view organization conversations" ON public.conversations;
DROP POLICY IF EXISTS "SDR can view assigned conversations" ON public.conversations;

CREATE POLICY "Users can view accessible conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (
  can_access_conversation_channel((SELECT auth.uid()), user_id, instance_id, meta_phone_number_id)
  OR (
    (SELECT is_sdr((SELECT auth.uid())))
    AND (
      (instance_id IS NOT NULL AND instance_id IN (SELECT get_sdr_instance_ids((SELECT auth.uid()))))
      OR (meta_phone_number_id IS NOT NULL AND meta_phone_number_id IN (SELECT get_sdr_meta_phone_number_ids((SELECT auth.uid()))))
    )
  )
);

DROP POLICY IF EXISTS "Users can update organization conversations" ON public.conversations;
DROP POLICY IF EXISTS "SDR can update assigned conversations" ON public.conversations;

CREATE POLICY "Users can update accessible conversations"
ON public.conversations
FOR UPDATE
TO authenticated
USING (
  can_access_conversation_channel((SELECT auth.uid()), user_id, instance_id, meta_phone_number_id)
  OR (
    (SELECT is_sdr((SELECT auth.uid())))
    AND (
      (instance_id IS NOT NULL AND instance_id IN (SELECT get_sdr_instance_ids((SELECT auth.uid()))))
      OR (meta_phone_number_id IS NOT NULL AND meta_phone_number_id IN (SELECT get_sdr_meta_phone_number_ids((SELECT auth.uid()))))
    )
  )
);

DROP POLICY IF EXISTS "Users can delete organization conversations" ON public.conversations;
CREATE POLICY "Users can delete organization conversations"
ON public.conversations
FOR DELETE
TO authenticated
USING (
  can_access_conversation_channel((SELECT auth.uid()), user_id, instance_id, meta_phone_number_id)
);

-- FUNNEL_DEALS: unir SELECT policies e usar InitPlan
DROP POLICY IF EXISTS "Users can view organization deals" ON public.funnel_deals;
DROP POLICY IF EXISTS "SDR can view assigned deals" ON public.funnel_deals;

CREATE POLICY "Users can view accessible deals"
ON public.funnel_deals
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR user_id IN (SELECT get_organization_member_ids((SELECT auth.uid())))
  OR (
    (SELECT is_sdr((SELECT auth.uid())))
    AND user_id IN (SELECT get_sdr_user_ids_scope((SELECT auth.uid())))
  )
);

DROP POLICY IF EXISTS "Org members can update org deals" ON public.funnel_deals;
CREATE POLICY "Org members can update org deals"
ON public.funnel_deals
FOR UPDATE
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR user_id IN (SELECT get_organization_member_ids((SELECT auth.uid())))
);

DROP POLICY IF EXISTS "Org members can delete org deals" ON public.funnel_deals;
CREATE POLICY "Org members can delete org deals"
ON public.funnel_deals
FOR DELETE
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR user_id IN (SELECT get_organization_member_ids((SELECT auth.uid())))
);

-- Reset das estatísticas para medir o antes/depois
SELECT pg_stat_statements_reset();
