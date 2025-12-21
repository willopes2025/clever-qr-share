-- Add is_pinned field to conversations table
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;

-- Create conversation_tags table for tag definitions
CREATE TABLE IF NOT EXISTS public.conversation_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on conversation_tags
ALTER TABLE public.conversation_tags ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for conversation_tags
CREATE POLICY "Users can view their own conversation tags" 
  ON public.conversation_tags FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversation tags" 
  ON public.conversation_tags FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversation tags" 
  ON public.conversation_tags FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversation tags" 
  ON public.conversation_tags FOR DELETE 
  USING (auth.uid() = user_id);

-- Create conversation_tag_assignments table for many-to-many relationship
CREATE TABLE IF NOT EXISTS public.conversation_tag_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.conversation_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, tag_id)
);

-- Enable RLS on conversation_tag_assignments
ALTER TABLE public.conversation_tag_assignments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for conversation_tag_assignments
CREATE POLICY "Users can view their conversation tag assignments" 
  ON public.conversation_tag_assignments FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE conversations.id = conversation_tag_assignments.conversation_id 
    AND conversations.user_id = auth.uid()
  ));

CREATE POLICY "Users can create their conversation tag assignments" 
  ON public.conversation_tag_assignments FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE conversations.id = conversation_tag_assignments.conversation_id 
    AND conversations.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their conversation tag assignments" 
  ON public.conversation_tag_assignments FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE conversations.id = conversation_tag_assignments.conversation_id 
    AND conversations.user_id = auth.uid()
  ));

-- Create storage bucket for inbox media
INSERT INTO storage.buckets (id, name, public) 
VALUES ('inbox-media', 'inbox-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for inbox-media bucket
CREATE POLICY "Users can upload inbox media" 
  ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'inbox-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view inbox media" 
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'inbox-media');

CREATE POLICY "Users can update their inbox media" 
  ON storage.objects FOR UPDATE 
  USING (bucket_id = 'inbox-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their inbox media" 
  ON storage.objects FOR DELETE 
  USING (bucket_id = 'inbox-media' AND auth.uid()::text = (storage.foldername(name))[1]);