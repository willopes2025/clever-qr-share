-- Add enrichment columns to instagram_comments table
ALTER TABLE public.instagram_comments
ADD COLUMN IF NOT EXISTS commenter_biography text,
ADD COLUMN IF NOT EXISTS commenter_email text,
ADD COLUMN IF NOT EXISTS commenter_phone text,
ADD COLUMN IF NOT EXISTS commenter_followers_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS commenter_following_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS commenter_posts_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS commenter_is_business boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS commenter_business_category text,
ADD COLUMN IF NOT EXISTS commenter_external_url text,
ADD COLUMN IF NOT EXISTS enriched_at timestamptz;

-- Add index for filtering enriched comments
CREATE INDEX IF NOT EXISTS idx_instagram_comments_enriched ON public.instagram_comments(enriched_at) WHERE enriched_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_instagram_comments_email ON public.instagram_comments(commenter_email) WHERE commenter_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_instagram_comments_phone ON public.instagram_comments(commenter_phone) WHERE commenter_phone IS NOT NULL;