ALTER TABLE public.conversation_tasks ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;
ALTER TABLE public.deal_tasks ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_conversation_tasks_pinned ON public.conversation_tasks(conversation_id, is_pinned) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_deal_tasks_pinned ON public.deal_tasks(deal_id, is_pinned) WHERE is_pinned = true;