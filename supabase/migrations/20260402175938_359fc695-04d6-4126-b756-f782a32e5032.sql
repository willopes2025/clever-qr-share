
-- Groups table
CREATE TABLE public.internal_chat_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_chat_groups ENABLE ROW LEVEL SECURITY;

-- Group members table
CREATE TABLE public.internal_chat_group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.internal_chat_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE public.internal_chat_group_members ENABLE ROW LEVEL SECURITY;

-- Group messages table
CREATE TABLE public.internal_group_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.internal_chat_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_group_messages ENABLE ROW LEVEL SECURITY;

-- Enable realtime for group messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_group_messages;

-- RLS: Groups - members can see their groups
CREATE POLICY "Members can view their groups"
ON public.internal_chat_groups FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.internal_chat_group_members
    WHERE group_id = id AND user_id = auth.uid()
  )
);

CREATE POLICY "Authenticated users can create groups"
ON public.internal_chat_groups FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator can update group"
ON public.internal_chat_groups FOR UPDATE
TO authenticated
USING (auth.uid() = created_by);

CREATE POLICY "Creator can delete group"
ON public.internal_chat_groups FOR DELETE
TO authenticated
USING (auth.uid() = created_by);

-- RLS: Group members
CREATE POLICY "Members can view group members"
ON public.internal_chat_group_members FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.internal_chat_group_members gm
    WHERE gm.group_id = internal_chat_group_members.group_id AND gm.user_id = auth.uid()
  )
);

CREATE POLICY "Group creator can manage members"
ON public.internal_chat_group_members FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.internal_chat_groups g
    WHERE g.id = group_id AND g.created_by = auth.uid()
  )
  OR auth.uid() = user_id
);

CREATE POLICY "Group creator can remove members"
ON public.internal_chat_group_members FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.internal_chat_groups g
    WHERE g.id = group_id AND g.created_by = auth.uid()
  )
  OR auth.uid() = user_id
);

-- RLS: Group messages
CREATE POLICY "Members can view group messages"
ON public.internal_group_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.internal_chat_group_members
    WHERE group_id = internal_group_messages.group_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Members can send group messages"
ON public.internal_group_messages FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.internal_chat_group_members
    WHERE group_id = internal_group_messages.group_id AND user_id = auth.uid()
  )
);
