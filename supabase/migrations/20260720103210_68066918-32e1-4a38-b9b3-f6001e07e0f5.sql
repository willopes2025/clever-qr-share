
ALTER TABLE public.email_channels
  ADD COLUMN IF NOT EXISTS imap_host TEXT,
  ADD COLUMN IF NOT EXISTS imap_port INTEGER,
  ADD COLUMN IF NOT EXISTS imap_secure BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS smtp_host TEXT,
  ADD COLUMN IF NOT EXISTS smtp_port INTEGER,
  ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS auth_username TEXT,
  ADD COLUMN IF NOT EXISTS auth_password TEXT,
  ADD COLUMN IF NOT EXISTS last_uid BIGINT;

CREATE INDEX IF NOT EXISTS idx_email_channels_provider ON public.email_channels(provider);
