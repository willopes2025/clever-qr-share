ALTER TABLE public.funnels 
ADD COLUMN IF NOT EXISTS opportunity_prompt text,
ADD COLUMN IF NOT EXISTS opportunity_message_days integer DEFAULT 30;