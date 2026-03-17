
-- Drop existing policies on ai_knowledge_suggestions
DROP POLICY IF EXISTS "Users can view their own suggestions" ON public.ai_knowledge_suggestions;
DROP POLICY IF EXISTS "Users can insert their own suggestions" ON public.ai_knowledge_suggestions;
DROP POLICY IF EXISTS "Users can update their own suggestions" ON public.ai_knowledge_suggestions;
DROP POLICY IF EXISTS "Users can delete their own suggestions" ON public.ai_knowledge_suggestions;

-- Recreate with org-wide access
CREATE POLICY "Org members can view suggestions"
  ON public.ai_knowledge_suggestions FOR SELECT
  TO authenticated
  USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE POLICY "Org members can insert suggestions"
  ON public.ai_knowledge_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE POLICY "Org members can update suggestions"
  ON public.ai_knowledge_suggestions FOR UPDATE
  TO authenticated
  USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE POLICY "Org members can delete suggestions"
  ON public.ai_knowledge_suggestions FOR DELETE
  TO authenticated
  USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

-- Drop existing policies on ai_agent_knowledge_items
DROP POLICY IF EXISTS "Users can view their own knowledge items" ON public.ai_agent_knowledge_items;
DROP POLICY IF EXISTS "Users can insert their own knowledge items" ON public.ai_agent_knowledge_items;
DROP POLICY IF EXISTS "Users can update their own knowledge items" ON public.ai_agent_knowledge_items;
DROP POLICY IF EXISTS "Users can delete their own knowledge items" ON public.ai_agent_knowledge_items;

-- Recreate with org-wide access
CREATE POLICY "Org members can view knowledge items"
  ON public.ai_agent_knowledge_items FOR SELECT
  TO authenticated
  USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE POLICY "Org members can insert knowledge items"
  ON public.ai_agent_knowledge_items FOR INSERT
  TO authenticated
  WITH CHECK (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE POLICY "Org members can update knowledge items"
  ON public.ai_agent_knowledge_items FOR UPDATE
  TO authenticated
  USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE POLICY "Org members can delete knowledge items"
  ON public.ai_agent_knowledge_items FOR DELETE
  TO authenticated
  USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));
