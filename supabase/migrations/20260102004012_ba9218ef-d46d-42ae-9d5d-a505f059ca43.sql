-- Create table for AI agent integrations (API and webhooks)
CREATE TABLE public.ai_agent_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_config_id UUID NOT NULL REFERENCES public.ai_agent_configs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Integration type
  integration_type TEXT NOT NULL CHECK (integration_type IN ('api', 'webhook_in', 'webhook_out')),
  
  -- General configuration
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  
  -- For API integrations
  api_base_url TEXT,
  api_auth_type TEXT CHECK (api_auth_type IN ('bearer', 'api_key', 'basic', 'oauth2', 'none')),
  api_credentials JSONB DEFAULT '{}',
  api_headers JSONB DEFAULT '{}',
  
  -- For incoming webhooks (receive data)
  webhook_url TEXT,
  webhook_token TEXT,
  
  -- For outgoing webhooks (send data)
  webhook_target_url TEXT,
  webhook_events TEXT[],
  webhook_payload_template JSONB,
  
  -- Logs and status
  last_used_at TIMESTAMPTZ,
  last_error TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_agent_integrations_agent ON public.ai_agent_integrations(agent_config_id);
CREATE INDEX idx_agent_integrations_user ON public.ai_agent_integrations(user_id);
CREATE INDEX idx_agent_integrations_webhook_token ON public.ai_agent_integrations(webhook_token) WHERE webhook_token IS NOT NULL;

-- Enable RLS
ALTER TABLE public.ai_agent_integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their agent integrations"
  ON public.ai_agent_integrations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all integrations"
  ON public.ai_agent_integrations
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_ai_agent_integrations_updated_at
  BEFORE UPDATE ON public.ai_agent_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for webhook logs
CREATE TABLE public.ai_agent_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.ai_agent_integrations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  event_type TEXT,
  payload JSONB,
  response_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for logs
CREATE INDEX idx_webhook_logs_integration ON public.ai_agent_webhook_logs(integration_id);
CREATE INDEX idx_webhook_logs_created ON public.ai_agent_webhook_logs(created_at DESC);

-- Enable RLS on logs
ALTER TABLE public.ai_agent_webhook_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for logs
CREATE POLICY "Users can view their webhook logs"
  ON public.ai_agent_webhook_logs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their webhook logs"
  ON public.ai_agent_webhook_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all webhook logs"
  ON public.ai_agent_webhook_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);