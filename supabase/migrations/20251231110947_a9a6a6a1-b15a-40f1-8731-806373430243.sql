-- Create table for customizable lead panel tabs
CREATE TABLE public.lead_panel_tabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  field_keys JSONB DEFAULT '[]'::jsonb,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_panel_tabs ENABLE ROW LEVEL SECURITY;

-- Policy for users to manage their own tabs
CREATE POLICY "Users can view their own tabs"
ON public.lead_panel_tabs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tabs"
ON public.lead_panel_tabs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tabs"
ON public.lead_panel_tabs
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tabs"
ON public.lead_panel_tabs
FOR DELETE
USING (auth.uid() = user_id);

-- Policy for organization members to share tabs
CREATE POLICY "Users can view organization tabs"
ON public.lead_panel_tabs
FOR SELECT
USING (user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- Trigger for updated_at
CREATE TRIGGER update_lead_panel_tabs_updated_at
BEFORE UPDATE ON public.lead_panel_tabs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();