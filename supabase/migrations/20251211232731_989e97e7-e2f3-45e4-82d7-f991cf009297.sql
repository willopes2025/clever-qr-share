-- Create enum for broadcast list types
CREATE TYPE public.broadcast_list_type AS ENUM ('manual', 'dynamic');

-- Create broadcast_lists table
CREATE TABLE public.broadcast_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type broadcast_list_type NOT NULL DEFAULT 'manual',
  filter_criteria JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.broadcast_lists ENABLE ROW LEVEL SECURITY;

-- RLS policies for broadcast_lists
CREATE POLICY "Users can view their own broadcast lists"
ON public.broadcast_lists FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own broadcast lists"
ON public.broadcast_lists FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own broadcast lists"
ON public.broadcast_lists FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own broadcast lists"
ON public.broadcast_lists FOR DELETE
USING (auth.uid() = user_id);

-- Create broadcast_list_contacts table (for manual lists)
CREATE TABLE public.broadcast_list_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.broadcast_lists(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(list_id, contact_id)
);

-- Enable RLS
ALTER TABLE public.broadcast_list_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies for broadcast_list_contacts
CREATE POLICY "Users can view contacts in their lists"
ON public.broadcast_list_contacts FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.broadcast_lists
  WHERE broadcast_lists.id = broadcast_list_contacts.list_id
  AND broadcast_lists.user_id = auth.uid()
));

CREATE POLICY "Users can add contacts to their lists"
ON public.broadcast_list_contacts FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.broadcast_lists
  WHERE broadcast_lists.id = broadcast_list_contacts.list_id
  AND broadcast_lists.user_id = auth.uid()
));

CREATE POLICY "Users can remove contacts from their lists"
ON public.broadcast_list_contacts FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.broadcast_lists
  WHERE broadcast_lists.id = broadcast_list_contacts.list_id
  AND broadcast_lists.user_id = auth.uid()
));

-- Create broadcast_sends table (send history)
CREATE TABLE public.broadcast_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.broadcast_lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  total_contacts INTEGER NOT NULL DEFAULT 0,
  delivered INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.broadcast_sends ENABLE ROW LEVEL SECURITY;

-- RLS policies for broadcast_sends
CREATE POLICY "Users can view their own broadcast sends"
ON public.broadcast_sends FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own broadcast sends"
ON public.broadcast_sends FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own broadcast sends"
ON public.broadcast_sends FOR UPDATE
USING (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_broadcast_lists_updated_at
BEFORE UPDATE ON public.broadcast_lists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();