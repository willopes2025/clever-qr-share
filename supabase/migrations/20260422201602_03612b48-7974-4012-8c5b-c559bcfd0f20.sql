CREATE OR REPLACE FUNCTION public.get_member_meta_phone_number_ids(_user_id uuid)
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT mwn.phone_number_id
  FROM public.team_member_meta_numbers tmmn
  JOIN public.team_members tm ON tm.id = tmmn.team_member_id
  JOIN public.meta_whatsapp_numbers mwn ON mwn.id = tmmn.meta_number_id
  WHERE tm.user_id = _user_id
    AND tm.status = 'active'
    AND mwn.phone_number_id IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.can_access_conversation_channel(
  _user_id uuid,
  _conversation_user_id uuid,
  _instance_id uuid,
  _meta_phone_number_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH org_scope AS (
    SELECT _conversation_user_id IN (
      SELECT public.get_organization_member_ids(_user_id)
    ) AS in_org
  )
  SELECT COALESCE(
    (
      (
        _instance_id IS NOT NULL
        AND (
          (
            public.member_has_instance_restriction(_user_id)
            AND _instance_id IN (
              SELECT public.get_member_instance_ids(_user_id)
            )
          )
          OR (
            NOT public.member_has_instance_restriction(_user_id)
            AND (SELECT in_org FROM org_scope)
          )
        )
      )
      OR (
        _meta_phone_number_id IS NOT NULL
        AND (
          (
            public.member_has_meta_restriction(_user_id)
            AND _meta_phone_number_id IN (
              SELECT public.get_member_meta_phone_number_ids(_user_id)
            )
          )
          OR (
            NOT public.member_has_meta_restriction(_user_id)
            AND (SELECT in_org FROM org_scope)
          )
        )
      )
      OR (
        _instance_id IS NULL
        AND _meta_phone_number_id IS NULL
        AND (SELECT in_org FROM org_scope)
      )
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_conversation(
  _user_id uuid,
  _conversation_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = _conversation_id
      AND public.can_access_conversation_channel(
        _user_id,
        c.user_id,
        c.instance_id,
        c.meta_phone_number_id
      )
  )
$$;

DROP POLICY IF EXISTS "Users can view organization conversations" ON public.conversations;
CREATE POLICY "Users can view organization conversations"
ON public.conversations
FOR SELECT
USING (
  public.can_access_conversation_channel(
    auth.uid(),
    user_id,
    instance_id,
    meta_phone_number_id
  )
);

DROP POLICY IF EXISTS "Users can update organization conversations" ON public.conversations;
CREATE POLICY "Users can update organization conversations"
ON public.conversations
FOR UPDATE
USING (
  public.can_access_conversation_channel(
    auth.uid(),
    user_id,
    instance_id,
    meta_phone_number_id
  )
)
WITH CHECK (
  public.can_access_conversation_channel(
    auth.uid(),
    user_id,
    instance_id,
    meta_phone_number_id
  )
);

DROP POLICY IF EXISTS "Users can delete organization conversations" ON public.conversations;
CREATE POLICY "Users can delete organization conversations"
ON public.conversations
FOR DELETE
USING (
  public.can_access_conversation_channel(
    auth.uid(),
    user_id,
    instance_id,
    meta_phone_number_id
  )
);

DROP POLICY IF EXISTS "Users can create their own conversations" ON public.conversations;
CREATE POLICY "Users can create their own conversations"
ON public.conversations
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND public.can_access_conversation_channel(
    auth.uid(),
    user_id,
    instance_id,
    meta_phone_number_id
  )
);

DROP POLICY IF EXISTS "Users can view organization messages" ON public.inbox_messages;
CREATE POLICY "Users can view organization messages"
ON public.inbox_messages
FOR SELECT
USING (
  public.can_access_conversation(auth.uid(), conversation_id)
);

DROP POLICY IF EXISTS "Users can update their own messages" ON public.inbox_messages;
CREATE POLICY "Users can update their own messages"
ON public.inbox_messages
FOR UPDATE
USING (
  public.can_access_conversation(auth.uid(), conversation_id)
)
WITH CHECK (
  public.can_access_conversation(auth.uid(), conversation_id)
);

DROP POLICY IF EXISTS "Users can create their own messages" ON public.inbox_messages;
CREATE POLICY "Users can create their own messages"
ON public.inbox_messages
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND public.can_access_conversation(auth.uid(), conversation_id)
);