-- Add custom_fields column to funnel_deals table
ALTER TABLE public.funnel_deals 
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;