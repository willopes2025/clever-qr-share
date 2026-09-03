ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS addressing_mode text,
  ADD COLUMN IF NOT EXISTS remote_jid text;

ALTER TABLE public.inbox_messages
  ADD COLUMN IF NOT EXISTS sent_to_jid text;

CREATE INDEX IF NOT EXISTS idx_inbox_messages_stuck_sent
  ON public.inbox_messages (created_at)
  WHERE direction = 'outbound' AND status = 'sent';