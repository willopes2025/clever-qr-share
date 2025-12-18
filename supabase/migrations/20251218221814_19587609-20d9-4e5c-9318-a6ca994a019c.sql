-- Add campaign-specific sending settings
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS message_interval_min integer DEFAULT 3;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS message_interval_max integer DEFAULT 10;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS daily_limit integer DEFAULT 1000;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS allowed_start_hour integer DEFAULT 8;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS allowed_end_hour integer DEFAULT 20;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS allowed_days text[] DEFAULT ARRAY['mon', 'tue', 'wed', 'thu', 'fri'];
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/Sao_Paulo';