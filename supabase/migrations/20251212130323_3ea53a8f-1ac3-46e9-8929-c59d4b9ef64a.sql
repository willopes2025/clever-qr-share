-- Add columns for multiple instances and sending mode
ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS instance_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS sending_mode TEXT DEFAULT 'sequential' CHECK (sending_mode IN ('sequential', 'random'));