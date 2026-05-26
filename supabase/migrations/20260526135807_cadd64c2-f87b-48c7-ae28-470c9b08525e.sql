-- Add per-user sequential lead_number to funnel_deals
ALTER TABLE public.funnel_deals ADD COLUMN IF NOT EXISTS lead_number BIGINT;

CREATE INDEX IF NOT EXISTS idx_funnel_deals_user_lead_number ON public.funnel_deals(user_id, lead_number);

-- Backfill existing deals: number per user_id ordered by created_at
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at, id) AS rn
  FROM public.funnel_deals
  WHERE lead_number IS NULL
)
UPDATE public.funnel_deals fd
SET lead_number = numbered.rn
FROM numbered
WHERE fd.id = numbered.id;

-- Trigger to auto-assign next lead_number per user
CREATE OR REPLACE FUNCTION public.assign_funnel_deal_lead_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.lead_number IS NULL THEN
    SELECT COALESCE(MAX(lead_number), 0) + 1
      INTO NEW.lead_number
      FROM public.funnel_deals
      WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_funnel_deal_lead_number ON public.funnel_deals;
CREATE TRIGGER trg_assign_funnel_deal_lead_number
BEFORE INSERT ON public.funnel_deals
FOR EACH ROW
EXECUTE FUNCTION public.assign_funnel_deal_lead_number();