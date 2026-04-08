
-- Table for tracking individual node executions in chatbot flows
CREATE TABLE public.chatbot_node_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES public.chatbot_executions(id) ON DELETE CASCADE NOT NULL,
  flow_id UUID REFERENCES public.chatbot_flows(id) ON DELETE CASCADE NOT NULL,
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'processed',
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chatbot_node_executions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own node executions"
ON public.chatbot_node_executions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own node executions"
ON public.chatbot_node_executions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own node executions"
ON public.chatbot_node_executions FOR UPDATE
USING (auth.uid() = user_id);

-- Service role needs access from edge functions
CREATE POLICY "Service role full access to node executions"
ON public.chatbot_node_executions FOR ALL
USING (true)
WITH CHECK (true);

-- Performance indexes
CREATE INDEX idx_chatbot_node_exec_execution ON public.chatbot_node_executions(execution_id);
CREATE INDEX idx_chatbot_node_exec_flow_node ON public.chatbot_node_executions(flow_id, node_id);
CREATE INDEX idx_chatbot_node_exec_flow_date ON public.chatbot_node_executions(flow_id, created_at);
