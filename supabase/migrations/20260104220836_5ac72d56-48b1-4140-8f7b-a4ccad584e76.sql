-- Add url_static_params column to forms table for storing static URL parameters
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS url_static_params JSONB DEFAULT '[]';

-- Add comment explaining the column structure
COMMENT ON COLUMN public.forms.url_static_params IS 'Array of static URL parameters: [{key: string, value: string}]';