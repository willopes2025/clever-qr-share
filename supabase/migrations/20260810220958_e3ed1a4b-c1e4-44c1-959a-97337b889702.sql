ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS send_days smallint[] NOT NULL DEFAULT '{1,2,3,4,5}',
  ADD COLUMN IF NOT EXISTS send_start_hour smallint NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS send_end_hour smallint NOT NULL DEFAULT 18;