-- Add funnel destination columns to forms table
ALTER TABLE public.forms 
ADD COLUMN IF NOT EXISTS target_funnel_id UUID REFERENCES public.funnels(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS target_stage_id UUID REFERENCES public.funnel_stages(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.forms.target_funnel_id IS 'Funil para onde leads serão enviados automaticamente';
COMMENT ON COLUMN public.forms.target_stage_id IS 'Estágio inicial do lead no funil';