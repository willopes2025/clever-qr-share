
-- chatbot_flows: permitir SELECT por membros da org
DROP POLICY IF EXISTS "Users can view their own flows" ON chatbot_flows;
CREATE POLICY "Users can view organization flows" ON chatbot_flows
  FOR SELECT USING (user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- chatbot_flow_nodes: permitir SELECT por membros da org
DROP POLICY IF EXISTS "Users can view their own nodes" ON chatbot_flow_nodes;
CREATE POLICY "Users can view organization nodes" ON chatbot_flow_nodes
  FOR SELECT USING (user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- chatbot_flow_edges: permitir SELECT por membros da org
DROP POLICY IF EXISTS "Users can view their own edges" ON chatbot_flow_edges;
CREATE POLICY "Users can view organization edges" ON chatbot_flow_edges
  FOR SELECT USING (user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- chatbot_executions: substituir ALL por políticas granulares
DROP POLICY IF EXISTS "Users can manage their chatbot executions" ON chatbot_executions;
CREATE POLICY "Users can view organization executions" ON chatbot_executions
  FOR SELECT USING (user_id IN (SELECT get_organization_member_ids(auth.uid())));
CREATE POLICY "Users can insert their own executions" ON chatbot_executions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update organization executions" ON chatbot_executions
  FOR UPDATE USING (user_id IN (SELECT get_organization_member_ids(auth.uid())));
CREATE POLICY "Users can delete their own executions" ON chatbot_executions
  FOR DELETE USING (auth.uid() = user_id);
