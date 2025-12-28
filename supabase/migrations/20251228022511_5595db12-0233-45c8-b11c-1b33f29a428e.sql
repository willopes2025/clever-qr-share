-- Create chatbot_executions table to track chatbot flow executions
CREATE TABLE chatbot_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID REFERENCES chatbot_flows(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES funnel_deals(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, running, completed, failed
  trigger_source TEXT, -- manual, funnel_automation, webhook, message
  trigger_automation_id UUID REFERENCES funnel_automations(id) ON DELETE SET NULL,
  current_node_id TEXT,
  variables JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE chatbot_executions ENABLE ROW LEVEL SECURITY;

-- Create policy for users to manage their chatbot executions
CREATE POLICY "Users can manage their chatbot executions" ON chatbot_executions
  FOR ALL USING (user_id = auth.uid());

-- Add index for faster lookups
CREATE INDEX idx_chatbot_executions_flow_id ON chatbot_executions(flow_id);
CREATE INDEX idx_chatbot_executions_contact_id ON chatbot_executions(contact_id);
CREATE INDEX idx_chatbot_executions_status ON chatbot_executions(status);