ALTER TABLE public.conversation_notes 
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS media_type TEXT,
  ADD COLUMN IF NOT EXISTS media_name TEXT;