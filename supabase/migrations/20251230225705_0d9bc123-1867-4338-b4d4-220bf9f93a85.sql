-- Add columns to internal_messages for WhatsApp integration
ALTER TABLE public.internal_messages ADD COLUMN IF NOT EXISTS whatsapp_message_id text;
ALTER TABLE public.internal_messages ADD COLUMN IF NOT EXISTS source text DEFAULT 'web';

-- Add notify_internal_chat to notification_preferences
ALTER TABLE public.notification_preferences ADD COLUMN IF NOT EXISTS notify_internal_chat boolean DEFAULT true;

-- Create table to track internal chat sessions for WhatsApp replies
CREATE TABLE IF NOT EXISTS public.internal_chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  whatsapp_phone text NOT NULL,
  last_message_preview text,
  last_activity_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.internal_chat_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for internal_chat_sessions
CREATE POLICY "Users can view their own chat sessions"
ON public.internal_chat_sessions FOR SELECT
USING (user_id = auth.uid() OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

CREATE POLICY "Users can insert their own chat sessions"
ON public.internal_chat_sessions FOR INSERT
WITH CHECK (user_id = auth.uid() OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

CREATE POLICY "Users can update their own chat sessions"
ON public.internal_chat_sessions FOR UPDATE
USING (user_id = auth.uid() OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

CREATE POLICY "Users can delete their own chat sessions"
ON public.internal_chat_sessions FOR DELETE
USING (user_id = auth.uid() OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_internal_chat_sessions_whatsapp ON public.internal_chat_sessions(whatsapp_phone);
CREATE INDEX IF NOT EXISTS idx_internal_chat_sessions_conversation ON public.internal_chat_sessions(conversation_id);