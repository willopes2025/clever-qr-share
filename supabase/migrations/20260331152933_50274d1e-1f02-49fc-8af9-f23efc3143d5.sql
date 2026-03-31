
-- Table to track analysis rotation history per funnel
CREATE TABLE public.funnel_opportunity_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funnel_id UUID NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES public.funnel_deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analyzed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  batch_number INTEGER NOT NULL DEFAULT 1,
  UNIQUE(funnel_id, deal_id, batch_number)
);

-- Index for fast lookups
CREATE INDEX idx_funnel_opp_history_funnel ON public.funnel_opportunity_history(funnel_id, analyzed_at DESC);
CREATE INDEX idx_funnel_opp_history_deal ON public.funnel_opportunity_history(funnel_id, deal_id);

-- Enable RLS
ALTER TABLE public.funnel_opportunity_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own opportunity history"
  ON public.funnel_opportunity_history FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE POLICY "Users can insert own opportunity history"
  ON public.funnel_opportunity_history FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own opportunity history"
  ON public.funnel_opportunity_history FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

-- Add new config columns to funnels table
ALTER TABLE public.funnels ADD COLUMN IF NOT EXISTS opportunity_rotation_cooldown INTEGER DEFAULT 3;
ALTER TABLE public.funnels ADD COLUMN IF NOT EXISTS opportunity_batch_size INTEGER DEFAULT 30;
ALTER TABLE public.funnels ADD COLUMN IF NOT EXISTS opportunity_include_no_conversation BOOLEAN DEFAULT true;
ALTER TABLE public.funnels ADD COLUMN IF NOT EXISTS opportunity_conversation_priority TEXT DEFAULT 'balanced';
ALTER TABLE public.funnels ADD COLUMN IF NOT EXISTS opportunity_last_batch_number INTEGER DEFAULT 0;
