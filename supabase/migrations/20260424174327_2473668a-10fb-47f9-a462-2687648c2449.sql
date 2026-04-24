-- Fix infinite recursion in internal_chat_group_members RLS policy
-- by extracting the membership check into a SECURITY DEFINER function.

CREATE OR REPLACE FUNCTION public.is_internal_chat_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.internal_chat_group_members
    WHERE group_id = _group_id AND user_id = _user_id
  );
$$;

DROP POLICY IF EXISTS "Members can view group members" ON public.internal_chat_group_members;

CREATE POLICY "Members can view group members"
ON public.internal_chat_group_members
FOR SELECT
TO authenticated
USING (
  public.is_internal_chat_group_member(group_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.internal_chat_groups g
    WHERE g.id = internal_chat_group_members.group_id
      AND g.created_by = auth.uid()
  )
);