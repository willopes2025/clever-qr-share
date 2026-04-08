
-- Create message_reactions table
CREATE TABLE public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.inbox_messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  reacted_by TEXT NOT NULL,
  whatsapp_reaction_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_message_reactions_message_id ON public.message_reactions(message_id);
CREATE INDEX idx_message_reactions_conversation_id ON public.message_reactions(conversation_id);

-- Enable RLS
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- RLS policies using organization membership via conversation
CREATE POLICY "Org members can view reactions"
ON public.message_reactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
    AND c.user_id IN (SELECT get_organization_member_ids(auth.uid()))
  )
);

CREATE POLICY "Org members can insert reactions"
ON public.message_reactions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
    AND c.user_id IN (SELECT get_organization_member_ids(auth.uid()))
  )
);

CREATE POLICY "Org members can delete reactions"
ON public.message_reactions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
    AND c.user_id IN (SELECT get_organization_member_ids(auth.uid()))
  )
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
