-- Add skip_tag_id column to campaigns table for tag-based exclusion
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS skip_tag_id uuid REFERENCES public.tags(id) ON DELETE SET NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.campaigns.skip_tag_id IS 'Tag ID used to exclude contacts that have this tag applied';