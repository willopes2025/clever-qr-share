-- Create meta_templates table for WhatsApp Business templates that need Meta approval
CREATE TABLE public.meta_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  meta_template_id TEXT, -- ID returned by Meta after submission
  waba_id TEXT, -- WhatsApp Business Account ID
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'pt_BR',
  category TEXT NOT NULL CHECK (category IN ('MARKETING', 'UTILITY', 'AUTHENTICATION')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'paused', 'disabled')),
  rejection_reason TEXT,
  
  -- Template components
  header_type TEXT CHECK (header_type IN ('TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION', 'NONE')),
  header_content TEXT,
  header_example TEXT,
  body_text TEXT NOT NULL,
  body_examples JSONB DEFAULT '[]'::jsonb, -- Array of example values for variables
  footer_text TEXT,
  
  -- Buttons (up to 3)
  buttons JSONB DEFAULT '[]'::jsonb, -- [{type: 'QUICK_REPLY'|'URL'|'PHONE_NUMBER', text, url?, phone_number?}]
  
  -- Timestamps
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meta_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own meta templates"
  ON public.meta_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own meta templates"
  ON public.meta_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meta templates"
  ON public.meta_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meta templates"
  ON public.meta_templates FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_meta_templates_updated_at
  BEFORE UPDATE ON public.meta_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster queries
CREATE INDEX idx_meta_templates_user_id ON public.meta_templates(user_id);
CREATE INDEX idx_meta_templates_status ON public.meta_templates(status);
CREATE INDEX idx_meta_templates_name ON public.meta_templates(name);