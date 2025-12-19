-- Add manual_override column to subscriptions table
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS manual_override boolean DEFAULT false;