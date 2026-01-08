-- Create table for Instagram comments scraping
CREATE TABLE public.instagram_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  post_url TEXT NOT NULL,
  post_id TEXT,
  comment_id TEXT NOT NULL,
  comment_text TEXT,
  commenter_username TEXT NOT NULL,
  commenter_full_name TEXT,
  commenter_profile_pic TEXT,
  commenter_is_verified BOOLEAN DEFAULT false,
  likes_count INTEGER DEFAULT 0,
  timestamp TIMESTAMPTZ,
  is_reply BOOLEAN DEFAULT false,
  parent_comment_id TEXT,
  raw_data JSONB,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_instagram_comments_user_id ON public.instagram_comments(user_id);
CREATE INDEX idx_instagram_comments_post_url ON public.instagram_comments(post_url);
CREATE INDEX idx_instagram_comments_commenter_username ON public.instagram_comments(commenter_username);
CREATE INDEX idx_instagram_comments_scraped_at ON public.instagram_comments(scraped_at DESC);

-- Unique constraint to avoid duplicates
CREATE UNIQUE INDEX idx_instagram_comments_unique ON public.instagram_comments(user_id, post_url, comment_id);

-- Enable RLS
ALTER TABLE public.instagram_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own comments"
ON public.instagram_comments
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own comments"
ON public.instagram_comments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
ON public.instagram_comments
FOR DELETE
USING (auth.uid() = user_id);