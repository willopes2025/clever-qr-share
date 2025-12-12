-- Create template_variations table for AI-generated message variations
CREATE TABLE public.template_variations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.message_templates(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  variation_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(template_id, variation_index)
);

-- Enable Row Level Security
ALTER TABLE public.template_variations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their template variations"
  ON public.template_variations FOR SELECT
  USING (template_id IN (SELECT id FROM public.message_templates WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert variations for their templates"
  ON public.template_variations FOR INSERT
  WITH CHECK (template_id IN (SELECT id FROM public.message_templates WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their template variations"
  ON public.template_variations FOR DELETE
  USING (template_id IN (SELECT id FROM public.message_templates WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their template variations"
  ON public.template_variations FOR UPDATE
  USING (template_id IN (SELECT id FROM public.message_templates WHERE user_id = auth.uid()));

-- Add index for performance
CREATE INDEX idx_template_variations_template_id ON public.template_variations(template_id);