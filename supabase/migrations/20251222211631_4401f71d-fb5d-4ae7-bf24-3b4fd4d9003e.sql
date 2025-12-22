-- Create custom field definitions table
CREATE TABLE public.custom_field_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  field_key TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'boolean', 'date', 'select')),
  options JSONB DEFAULT '[]'::jsonb,
  is_required BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own field definitions"
ON public.custom_field_definitions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own field definitions"
ON public.custom_field_definitions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own field definitions"
ON public.custom_field_definitions
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own field definitions"
ON public.custom_field_definitions
FOR DELETE
USING (auth.uid() = user_id);

-- Create unique constraint for field_key per user
CREATE UNIQUE INDEX custom_field_definitions_user_key ON public.custom_field_definitions(user_id, field_key);