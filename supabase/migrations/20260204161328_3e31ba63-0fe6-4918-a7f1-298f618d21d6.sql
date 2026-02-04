-- Add skipped column to campaigns table to track duplicate contacts
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS skipped integer DEFAULT 0;