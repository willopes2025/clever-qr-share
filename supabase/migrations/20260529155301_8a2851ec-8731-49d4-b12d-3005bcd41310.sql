ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES public.funnel_deals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_form_submissions_deal_id ON public.form_submissions(deal_id);