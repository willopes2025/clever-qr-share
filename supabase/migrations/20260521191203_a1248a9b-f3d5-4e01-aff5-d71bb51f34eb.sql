CREATE INDEX IF NOT EXISTS idx_inbox_messages_created_at
ON public.inbox_messages (created_at DESC);