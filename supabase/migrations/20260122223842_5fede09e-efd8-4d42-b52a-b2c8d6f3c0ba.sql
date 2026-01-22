-- Add media columns to template_variations table
ALTER TABLE public.template_variations
ADD COLUMN media_type TEXT,
ADD COLUMN media_url TEXT,
ADD COLUMN media_filename TEXT;