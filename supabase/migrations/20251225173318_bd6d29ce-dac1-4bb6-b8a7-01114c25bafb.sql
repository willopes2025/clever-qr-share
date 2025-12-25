-- 1. Criar função auxiliar para buscar IDs de membros da mesma organização
CREATE OR REPLACE FUNCTION public.get_organization_member_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Membros da mesma organização via team_members
  SELECT DISTINCT tm2.user_id
  FROM public.team_members tm1
  JOIN public.team_members tm2 ON tm1.organization_id = tm2.organization_id
  WHERE tm1.user_id = _user_id 
    AND tm1.status = 'active'
    AND tm2.status = 'active'
    AND tm2.user_id IS NOT NULL
  
  UNION
  
  -- Incluir user_ids de organizações onde o usuário é owner
  SELECT DISTINCT tm.user_id
  FROM public.organizations o
  JOIN public.team_members tm ON tm.organization_id = o.id
  WHERE o.owner_id = _user_id
    AND tm.status = 'active'
    AND tm.user_id IS NOT NULL
  
  UNION
  
  -- Incluir o próprio owner_id das organizações onde o usuário é membro
  SELECT DISTINCT o.owner_id
  FROM public.team_members tm
  JOIN public.organizations o ON tm.organization_id = o.id
  WHERE tm.user_id = _user_id
    AND tm.status = 'active'
$$;

-- 2. Atualizar política de SELECT para contacts
DROP POLICY IF EXISTS "Users can view their own contacts" ON public.contacts;
CREATE POLICY "Users can view organization contacts" ON public.contacts
  FOR SELECT
  USING (
    user_id = auth.uid() 
    OR user_id IN (SELECT public.get_organization_member_ids(auth.uid()))
  );

-- 3. Atualizar política de SELECT para message_templates
DROP POLICY IF EXISTS "Users can view their own templates" ON public.message_templates;
CREATE POLICY "Users can view organization templates" ON public.message_templates
  FOR SELECT
  USING (
    user_id = auth.uid() 
    OR user_id IN (SELECT public.get_organization_member_ids(auth.uid()))
  );

-- 4. Atualizar política de SELECT para campaigns
DROP POLICY IF EXISTS "Users can view their own campaigns" ON public.campaigns;
CREATE POLICY "Users can view organization campaigns" ON public.campaigns
  FOR SELECT
  USING (
    user_id = auth.uid() 
    OR user_id IN (SELECT public.get_organization_member_ids(auth.uid()))
  );

-- 5. Atualizar política de SELECT para whatsapp_instances
DROP POLICY IF EXISTS "Users can view their own instances" ON public.whatsapp_instances;
CREATE POLICY "Users can view organization instances" ON public.whatsapp_instances
  FOR SELECT
  USING (
    user_id = auth.uid() 
    OR user_id IN (SELECT public.get_organization_member_ids(auth.uid()))
  );

-- 6. Atualizar política de SELECT para conversations
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
CREATE POLICY "Users can view organization conversations" ON public.conversations
  FOR SELECT
  USING (
    user_id = auth.uid() 
    OR user_id IN (SELECT public.get_organization_member_ids(auth.uid()))
  );

-- 7. Atualizar política de SELECT para broadcast_lists
DROP POLICY IF EXISTS "Users can view their own broadcast lists" ON public.broadcast_lists;
CREATE POLICY "Users can view organization broadcast lists" ON public.broadcast_lists
  FOR SELECT
  USING (
    user_id = auth.uid() 
    OR user_id IN (SELECT public.get_organization_member_ids(auth.uid()))
  );

-- 8. Atualizar política de SELECT para tags
DROP POLICY IF EXISTS "Users can view their own tags" ON public.tags;
CREATE POLICY "Users can view organization tags" ON public.tags
  FOR SELECT
  USING (
    user_id = auth.uid() 
    OR user_id IN (SELECT public.get_organization_member_ids(auth.uid()))
  );

-- 9. Atualizar política de SELECT para funnels
DROP POLICY IF EXISTS "Users can view their own funnels" ON public.funnels;
CREATE POLICY "Users can view organization funnels" ON public.funnels
  FOR SELECT
  USING (
    user_id = auth.uid() 
    OR user_id IN (SELECT public.get_organization_member_ids(auth.uid()))
  );

-- 10. Atualizar política de SELECT para funnel_deals
DROP POLICY IF EXISTS "Users can view their own deals" ON public.funnel_deals;
CREATE POLICY "Users can view organization deals" ON public.funnel_deals
  FOR SELECT
  USING (
    user_id = auth.uid() 
    OR user_id IN (SELECT public.get_organization_member_ids(auth.uid()))
  );

-- 11. Atualizar política de SELECT para inbox_messages (via conversation)
DROP POLICY IF EXISTS "Users can view their own messages" ON public.inbox_messages;
CREATE POLICY "Users can view organization messages" ON public.inbox_messages
  FOR SELECT
  USING (
    user_id = auth.uid() 
    OR user_id IN (SELECT public.get_organization_member_ids(auth.uid()))
  );

-- 12. Atualizar política de SELECT para conversation_tags
DROP POLICY IF EXISTS "Users can view their own conversation tags" ON public.conversation_tags;
CREATE POLICY "Users can view organization conversation tags" ON public.conversation_tags
  FOR SELECT
  USING (
    user_id = auth.uid() 
    OR user_id IN (SELECT public.get_organization_member_ids(auth.uid()))
  );

-- 13. Atualizar política de SELECT para ai_agent_configs
DROP POLICY IF EXISTS "Users can view their own configs" ON public.ai_agent_configs;
CREATE POLICY "Users can view organization configs" ON public.ai_agent_configs
  FOR SELECT
  USING (
    user_id = auth.uid() 
    OR user_id IN (SELECT public.get_organization_member_ids(auth.uid()))
  );

-- 14. Atualizar política de SELECT para user_settings
DROP POLICY IF EXISTS "Users can view their own settings" ON public.user_settings;
CREATE POLICY "Users can view organization settings" ON public.user_settings
  FOR SELECT
  USING (
    user_id = auth.uid() 
    OR user_id IN (SELECT public.get_organization_member_ids(auth.uid()))
  );

-- 15. Atualizar política de SELECT para custom_field_definitions
DROP POLICY IF EXISTS "Users can view their own field definitions" ON public.custom_field_definitions;
CREATE POLICY "Users can view organization field definitions" ON public.custom_field_definitions
  FOR SELECT
  USING (
    user_id = auth.uid() 
    OR user_id IN (SELECT public.get_organization_member_ids(auth.uid()))
  );

-- 16. Atualizar política de SELECT para warming_schedules
DROP POLICY IF EXISTS "Users can view their own warming schedules" ON public.warming_schedules;
CREATE POLICY "Users can view organization warming schedules" ON public.warming_schedules
  FOR SELECT
  USING (
    user_id = auth.uid() 
    OR user_id IN (SELECT public.get_organization_member_ids(auth.uid()))
  );

-- 17. Atualizar política de SELECT para deal_tasks
DROP POLICY IF EXISTS "Users can view their own deal tasks" ON public.deal_tasks;
CREATE POLICY "Users can view organization deal tasks" ON public.deal_tasks
  FOR SELECT
  USING (
    user_id = auth.uid() 
    OR user_id IN (SELECT public.get_organization_member_ids(auth.uid()))
  );