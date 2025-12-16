-- Drop the existing check constraint and recreate with warming option
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_sending_mode_check;

ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_sending_mode_check 
CHECK (sending_mode IN ('sequential', 'random', 'warming'));