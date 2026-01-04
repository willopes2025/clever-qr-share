-- Create forms table
CREATE TABLE public.forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  
  -- Static data for HTML rendering
  page_title TEXT,
  header_text TEXT,
  subheader_text TEXT,
  logo_url TEXT,
  background_color TEXT DEFAULT '#ffffff',
  primary_color TEXT DEFAULT '#3b82f6',
  font_family TEXT DEFAULT 'Inter',
  
  -- Behavior settings
  success_message TEXT DEFAULT 'Obrigado! Sua resposta foi enviada.',
  redirect_url TEXT,
  submit_button_text TEXT DEFAULT 'Enviar',
  
  -- SEO and sharing
  meta_description TEXT,
  og_image_url TEXT,
  
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, slug)
);

-- Create form_fields table
CREATE TABLE public.form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES public.forms ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  
  -- Field type and visual config
  field_type TEXT NOT NULL,
  label TEXT NOT NULL,
  placeholder TEXT,
  help_text TEXT,
  required BOOLEAN DEFAULT false,
  
  -- Options for selection fields
  options JSONB,
  
  -- Validation rules
  validation JSONB,
  
  -- Mapping to lead field
  mapping_type TEXT CHECK (mapping_type IN ('contact_field', 'custom_field', 'new_custom_field')),
  mapping_target TEXT,
  create_custom_field_on_submit BOOLEAN DEFAULT false,
  
  -- Conditional logic
  conditional_logic JSONB,
  
  position INTEGER NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create form_submissions table
CREATE TABLE public.form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES public.forms ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES public.contacts,
  user_id UUID NOT NULL,
  data JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create form_webhooks table
CREATE TABLE public.form_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES public.forms ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  target_url TEXT NOT NULL,
  events TEXT[] DEFAULT ARRAY['submission'],
  headers JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_webhooks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for forms
CREATE POLICY "Users can view their own forms"
ON public.forms FOR SELECT
USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE POLICY "Users can create their own forms"
ON public.forms FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own forms"
ON public.forms FOR UPDATE
USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE POLICY "Users can delete their own forms"
ON public.forms FOR DELETE
USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

-- RLS Policies for form_fields
CREATE POLICY "Users can view form fields"
ON public.form_fields FOR SELECT
USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE POLICY "Users can create form fields"
ON public.form_fields FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update form fields"
ON public.form_fields FOR UPDATE
USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE POLICY "Users can delete form fields"
ON public.form_fields FOR DELETE
USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

-- RLS Policies for form_submissions
CREATE POLICY "Users can view form submissions"
ON public.form_submissions FOR SELECT
USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE POLICY "Users can create form submissions"
ON public.form_submissions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete form submissions"
ON public.form_submissions FOR DELETE
USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

-- RLS Policies for form_webhooks
CREATE POLICY "Users can view form webhooks"
ON public.form_webhooks FOR SELECT
USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE POLICY "Users can create form webhooks"
ON public.form_webhooks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update form webhooks"
ON public.form_webhooks FOR UPDATE
USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE POLICY "Users can delete form webhooks"
ON public.form_webhooks FOR DELETE
USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

-- Create trigger for updated_at
CREATE TRIGGER update_forms_updated_at
BEFORE UPDATE ON public.forms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger type for funnel automations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'funnel_trigger_type' AND 'on_form_submission' = ANY(enum_range(NULL::funnel_trigger_type)::text[])) THEN
    ALTER TYPE funnel_trigger_type ADD VALUE IF NOT EXISTS 'on_form_submission';
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;