
-- Table to track last read timestamp per user per chat (DM or group)
CREATE TABLE public.internal_chat_read_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('member', 'group')),
  target_id TEXT NOT NULL,
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_type, target_id)
);

ALTER TABLE public.internal_chat_read_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own read status"
  ON public.internal_chat_read_status
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
