-- Create table for Instagram scrape results
CREATE TABLE public.instagram_scrape_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  username TEXT NOT NULL,
  full_name TEXT,
  biography TEXT,
  profile_pic_url TEXT,
  followers_count INTEGER,
  following_count INTEGER,
  posts_count INTEGER,
  is_business_account BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  business_category TEXT,
  external_url TEXT,
  email TEXT,
  phone TEXT,
  raw_data JSONB,
  scraped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.instagram_scrape_results ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX idx_instagram_scrape_results_user_id ON public.instagram_scrape_results(user_id);
CREATE INDEX idx_instagram_scrape_results_username ON public.instagram_scrape_results(username);
CREATE INDEX idx_instagram_scrape_results_scraped_at ON public.instagram_scrape_results(scraped_at DESC);

-- RLS Policies
CREATE POLICY "Users can view their own scrape results"
ON public.instagram_scrape_results
FOR SELECT
USING (
  user_id IN (SELECT public.get_organization_member_ids(auth.uid()))
);

CREATE POLICY "Users can insert their own scrape results"
ON public.instagram_scrape_results
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scrape results"
ON public.instagram_scrape_results
FOR DELETE
USING (auth.uid() = user_id);