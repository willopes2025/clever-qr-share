-- Add max_messages column to subscriptions table
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS max_messages integer;

-- Update existing free plan records to have the correct limits
UPDATE public.subscriptions 
SET max_instances = 1, max_messages = 300, status = 'active'
WHERE plan = 'free' AND (max_instances = 0 OR max_instances IS NULL);