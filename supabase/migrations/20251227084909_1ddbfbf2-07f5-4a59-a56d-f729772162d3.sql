-- Create conversation_notes table
CREATE TABLE public.conversation_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create conversation_tasks table
CREATE TABLE public.conversation_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  due_time TIME,
  priority TEXT DEFAULT 'normal',
  completed_at TIMESTAMPTZ,
  reminder_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create internal_messages table (chat between team members about a contact)
CREATE TABLE public.internal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  mentions UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.conversation_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for conversation_notes
CREATE POLICY "Users can view organization notes"
  ON public.conversation_notes FOR SELECT
  USING (user_id = auth.uid() OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

CREATE POLICY "Users can create their own notes"
  ON public.conversation_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes"
  ON public.conversation_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
  ON public.conversation_notes FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for conversation_tasks
CREATE POLICY "Users can view organization tasks"
  ON public.conversation_tasks FOR SELECT
  USING (user_id = auth.uid() OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

CREATE POLICY "Users can create their own tasks"
  ON public.conversation_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks"
  ON public.conversation_tasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tasks"
  ON public.conversation_tasks FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for internal_messages
CREATE POLICY "Users can view organization internal messages"
  ON public.internal_messages FOR SELECT
  USING (user_id = auth.uid() OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

CREATE POLICY "Users can create their own internal messages"
  ON public.internal_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own internal messages"
  ON public.internal_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Enable realtime for internal_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_messages;

-- Create indexes for better performance
CREATE INDEX idx_conversation_notes_contact ON public.conversation_notes(contact_id);
CREATE INDEX idx_conversation_notes_conversation ON public.conversation_notes(conversation_id);
CREATE INDEX idx_conversation_tasks_contact ON public.conversation_tasks(contact_id);
CREATE INDEX idx_conversation_tasks_conversation ON public.conversation_tasks(conversation_id);
CREATE INDEX idx_conversation_tasks_due_date ON public.conversation_tasks(due_date);
CREATE INDEX idx_internal_messages_contact ON public.internal_messages(contact_id);
CREATE INDEX idx_internal_messages_conversation ON public.internal_messages(conversation_id);

-- Add updated_at trigger for conversation_notes
CREATE TRIGGER update_conversation_notes_updated_at
  BEFORE UPDATE ON public.conversation_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add updated_at trigger for conversation_tasks
CREATE TRIGGER update_conversation_tasks_updated_at
  BEFORE UPDATE ON public.conversation_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();