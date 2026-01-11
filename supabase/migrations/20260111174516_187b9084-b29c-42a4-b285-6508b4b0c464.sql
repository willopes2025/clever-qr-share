-- Add new columns to instagram_scrape_results for enhanced data capture
ALTER TABLE public.instagram_scrape_results 
ADD COLUMN IF NOT EXISTS location_name text,
ADD COLUMN IF NOT EXISTS location_id text,
ADD COLUMN IF NOT EXISTS highlights_count integer,
ADD COLUMN IF NOT EXISTS reels_count integer,
ADD COLUMN IF NOT EXISTS igtv_count integer,
ADD COLUMN IF NOT EXISTS fbid text,
ADD COLUMN IF NOT EXISTS linked_facebook_page text,
ADD COLUMN IF NOT EXISTS latest_posts jsonb,
ADD COLUMN IF NOT EXISTS other_social_links jsonb,
ADD COLUMN IF NOT EXISTS engagement_score numeric(5,2),
ADD COLUMN IF NOT EXISTS is_suspicious boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS suspicious_reasons text[];

-- Add comment for documentation
COMMENT ON COLUMN public.instagram_scrape_results.engagement_score IS 'Calculated engagement rate: (likes + comments) / followers * 100';
COMMENT ON COLUMN public.instagram_scrape_results.is_suspicious IS 'Flag for potentially fake/bot accounts';
COMMENT ON COLUMN public.instagram_scrape_results.suspicious_reasons IS 'Array of reasons why account is flagged as suspicious';
COMMENT ON COLUMN public.instagram_scrape_results.other_social_links IS 'Links to other social networks extracted from bio';