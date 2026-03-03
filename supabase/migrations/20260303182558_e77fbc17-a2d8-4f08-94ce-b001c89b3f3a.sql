
-- Table for persisted opportunity analysis results
CREATE TABLE public.funnel_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id uuid NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.funnel_deals(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  conversation_id uuid,
  contact_name text,
  contact_phone text,
  contact_email text,
  contact_display_id text,
  stage_name text,
  value numeric DEFAULT 0,
  score integer DEFAULT 0,
  insight text,
  user_notes text,
  status text DEFAULT 'open',
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(funnel_id, deal_id)
);

ALTER TABLE public.funnel_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org opportunities" ON public.funnel_opportunities
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE POLICY "Users can insert own opportunities" ON public.funnel_opportunities
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update org opportunities" ON public.funnel_opportunities
  FOR UPDATE TO authenticated
  USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE POLICY "Users can delete org opportunities" ON public.funnel_opportunities
  FOR DELETE TO authenticated
  USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE TRIGGER update_funnel_opportunities_updated_at
  BEFORE UPDATE ON public.funnel_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
