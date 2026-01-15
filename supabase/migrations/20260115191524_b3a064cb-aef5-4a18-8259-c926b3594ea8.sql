-- Enable pg_cron and pg_net extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create storage bucket for warming images
INSERT INTO storage.buckets (id, name, public)
VALUES ('warming-images', 'warming-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: Allow public access to read images
CREATE POLICY "Public can view warming images"
ON storage.objects FOR SELECT
USING (bucket_id = 'warming-images');

-- Storage policy: Allow service role to insert images
CREATE POLICY "Service role can insert warming images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'warming-images');

-- Add category column to warming_content if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'warming_content' 
    AND column_name = 'category'
  ) THEN
    ALTER TABLE public.warming_content ADD COLUMN category TEXT DEFAULT 'generic';
  END IF;
END $$;

-- Add created_by_ai column to warming_content
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'warming_content' 
    AND column_name = 'created_by_ai'
  ) THEN
    ALTER TABLE public.warming_content ADD COLUMN created_by_ai BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Schedule auto-pair-warming-pool to run every 5 minutes
SELECT cron.schedule(
  'auto-pair-warming-pool',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://fgbenetdksqnvwkgnips.supabase.co/functions/v1/auto-pair-warming-pool',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnYmVuZXRka3NxbnZ3a2duaXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3Mzg1MjksImV4cCI6MjA3OTMxNDUyOX0.V2rhtyEt2VSO7O2BqZELTGkFOX9p8onqNWSe3aazgaM'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Schedule generate-daily-warming-news to run daily at 6 AM Brazil time (9 AM UTC)
SELECT cron.schedule(
  'generate-daily-warming-news',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://fgbenetdksqnvwkgnips.supabase.co/functions/v1/generate-daily-warming-news',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnYmVuZXRka3NxbnZ3a2duaXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3Mzg1MjksImV4cCI6MjA3OTMxNDUyOX0.V2rhtyEt2VSO7O2BqZELTGkFOX9p8onqNWSe3aazgaM'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);