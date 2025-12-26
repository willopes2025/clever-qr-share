-- Atualizar policy de UPDATE para incluir membros da organização
DROP POLICY IF EXISTS "Users can update their own agent configs" ON ai_agent_configs;
CREATE POLICY "Users can update own or organization agent configs"
ON ai_agent_configs FOR UPDATE
USING (
  auth.uid() = user_id 
  OR user_id IN (SELECT get_organization_member_ids(auth.uid()))
);

-- Atualizar policy de DELETE para incluir membros da organização
DROP POLICY IF EXISTS "Users can delete their own agent configs" ON ai_agent_configs;
CREATE POLICY "Users can delete own or organization agent configs"
ON ai_agent_configs FOR DELETE
USING (
  auth.uid() = user_id 
  OR user_id IN (SELECT get_organization_member_ids(auth.uid()))
);