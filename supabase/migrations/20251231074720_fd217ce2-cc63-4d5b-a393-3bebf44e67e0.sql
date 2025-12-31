-- Add avatar_url column to contacts table for profile pictures
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS avatar_url TEXT;