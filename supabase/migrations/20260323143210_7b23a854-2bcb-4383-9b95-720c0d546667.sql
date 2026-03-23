ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS auto_create_leads BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_lead_funnel_id UUID REFERENCES public.funnels(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS auto_lead_stage_id UUID REFERENCES public.funnel_stages(id) ON DELETE SET NULL;