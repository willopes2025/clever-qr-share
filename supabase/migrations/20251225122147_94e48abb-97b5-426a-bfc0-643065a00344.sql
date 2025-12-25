-- Add agent_config_id to calendar_integrations to link integrations to specific AI agents
ALTER TABLE public.calendar_integrations 
ADD COLUMN agent_config_id UUID REFERENCES public.ai_agent_configs(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX idx_calendar_integrations_agent_config_id ON public.calendar_integrations(agent_config_id);

-- Update RLS policy to allow access via agent config
CREATE POLICY "Users can manage integrations for their agents"
ON public.calendar_integrations
FOR ALL
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.ai_agent_configs
    WHERE ai_agent_configs.id = calendar_integrations.agent_config_id
    AND ai_agent_configs.user_id = auth.uid()
  )
)
WITH CHECK (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.ai_agent_configs
    WHERE ai_agent_configs.id = calendar_integrations.agent_config_id
    AND ai_agent_configs.user_id = auth.uid()
  )
);