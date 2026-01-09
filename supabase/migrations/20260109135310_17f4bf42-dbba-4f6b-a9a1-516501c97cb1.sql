-- Create table for Wil chat sessions
CREATE TABLE public.wil_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wil_chat_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only access their own sessions
CREATE POLICY "Users can view their own Wil sessions"
ON public.wil_chat_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own Wil sessions"
ON public.wil_chat_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Wil sessions"
ON public.wil_chat_sessions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Wil sessions"
ON public.wil_chat_sessions FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_wil_chat_sessions_updated_at
BEFORE UPDATE ON public.wil_chat_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_wil_chat_sessions_user_id ON public.wil_chat_sessions(user_id);

COMMENT ON TABLE public.wil_chat_sessions IS 'Stores chat sessions with Wil AI assistant';