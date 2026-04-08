
DROP POLICY "Service role full access to node executions" ON public.chatbot_node_executions;

CREATE POLICY "Service role full access to node executions"
ON public.chatbot_node_executions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
