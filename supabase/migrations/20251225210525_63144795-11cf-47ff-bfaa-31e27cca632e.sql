-- Add default_funnel_id to whatsapp_instances
ALTER TABLE public.whatsapp_instances 
ADD COLUMN default_funnel_id uuid REFERENCES public.funnels(id) ON DELETE SET NULL;

-- Add funnel_id to ai_agent_configs (to allow AI config per funnel, not just campaigns)
ALTER TABLE public.ai_agent_configs 
ADD COLUMN funnel_id uuid REFERENCES public.funnels(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX idx_whatsapp_instances_default_funnel ON public.whatsapp_instances(default_funnel_id);
CREATE INDEX idx_ai_agent_configs_funnel ON public.ai_agent_configs(funnel_id);

-- Add unique constraint to ensure only one AI config per funnel
CREATE UNIQUE INDEX idx_ai_agent_configs_unique_funnel ON public.ai_agent_configs(funnel_id) WHERE funnel_id IS NOT NULL;