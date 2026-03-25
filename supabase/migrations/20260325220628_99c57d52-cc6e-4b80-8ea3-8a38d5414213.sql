ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS batch_enabled boolean DEFAULT false;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS batch_size integer DEFAULT 5;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS batch_pause_minutes integer DEFAULT 30;