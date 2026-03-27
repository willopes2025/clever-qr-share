-- Add funnel routing columns to meta_whatsapp_numbers
ALTER TABLE public.meta_whatsapp_numbers 
ADD COLUMN IF NOT EXISTS default_funnel_id UUID REFERENCES public.funnels(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS default_stage_id UUID REFERENCES public.funnel_stages(id) ON DELETE SET NULL;

-- Create junction table for team member <-> meta number allocation
CREATE TABLE IF NOT EXISTS public.team_member_meta_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  meta_number_id UUID NOT NULL REFERENCES public.meta_whatsapp_numbers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_member_id, meta_number_id)
);

ALTER TABLE public.team_member_meta_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view team member meta numbers in their org"
  ON public.team_member_meta_numbers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm 
      WHERE tm.id = team_member_meta_numbers.team_member_id 
      AND tm.user_id IN (SELECT get_organization_member_ids(auth.uid()))
    )
  );

CREATE POLICY "Org admins can manage team member meta numbers"
  ON public.team_member_meta_numbers FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm 
      WHERE tm.id = team_member_meta_numbers.team_member_id 
      AND tm.organization_id IN (
        SELECT organization_id FROM public.team_members WHERE user_id = auth.uid() AND role IN ('admin', 'owner') AND status = 'active'
      )
    )
  );