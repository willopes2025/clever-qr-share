ALTER TABLE public.funnel_deals
  ADD COLUMN IF NOT EXISTS parent_deal_id uuid REFERENCES public.funnel_deals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_form_id uuid REFERENCES public.forms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_funnel_deals_parent_deal_id
  ON public.funnel_deals(parent_deal_id)
  WHERE parent_deal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_funnel_deals_source_form_id
  ON public.funnel_deals(source_form_id)
  WHERE source_form_id IS NOT NULL;