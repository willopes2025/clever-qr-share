-- Tabela de conversas
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_message_preview TEXT,
  unread_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, contact_id)
);

-- Tabela de mensagens do inbox
CREATE TABLE public.inbox_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  media_url TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  whatsapp_message_id TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;

-- Policies for conversations
CREATE POLICY "Users can view their own conversations" 
ON public.conversations FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations" 
ON public.conversations FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" 
ON public.conversations FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations" 
ON public.conversations FOR DELETE 
USING (auth.uid() = user_id);

-- Policies for inbox_messages
CREATE POLICY "Users can view their own messages" 
ON public.inbox_messages FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own messages" 
ON public.inbox_messages FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own messages" 
ON public.inbox_messages FOR UPDATE 
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX idx_conversations_last_message ON public.conversations(last_message_at DESC);
CREATE INDEX idx_inbox_messages_conversation ON public.inbox_messages(conversation_id);
CREATE INDEX idx_inbox_messages_sent_at ON public.inbox_messages(sent_at DESC);

-- Trigger to update updated_at
CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.inbox_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;