
-- =====================================================================
-- 1. Optimize get_organization_member_ids: collapse 4 UNIONs into a
--    single CTE walk. Same result set, much cheaper to execute, and
--    safe to call inside RLS policies.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_organization_member_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH my_orgs AS (
    -- organizations where the user is owner
    SELECT id AS org_id
    FROM public.organizations
    WHERE owner_id = _user_id
    UNION
    -- organizations where the user is an active team member
    SELECT organization_id AS org_id
    FROM public.team_members
    WHERE user_id = _user_id
      AND status = 'active'
  )
  SELECT _user_id
  UNION
  SELECT o.owner_id
  FROM public.organizations o
  WHERE o.id IN (SELECT org_id FROM my_orgs)
  UNION
  SELECT tm.user_id
  FROM public.team_members tm
  WHERE tm.organization_id IN (SELECT org_id FROM my_orgs)
    AND tm.status = 'active'
    AND tm.user_id IS NOT NULL
$$;

-- =====================================================================
-- 2. New helper: resolve, ONCE per query, whether _user_id has any
--    instance / meta restriction and the full set of allowed
--    user_ids in their organization scope.
--
--    By materializing this once we let Postgres reuse it across all
--    conversation rows instead of re-running 3 SECURITY DEFINER
--    functions per row inside the RLS policy.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.can_access_conversation_channel(
  _user_id uuid,
  _conversation_user_id uuid,
  _instance_id uuid,
  _meta_phone_number_id text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_in_org boolean;
  v_inst_restricted boolean;
  v_meta_restricted boolean;
  v_inst_allowed boolean;
  v_meta_allowed boolean;
BEGIN
  -- Org membership check (single call, cached by plpgsql plan)
  SELECT _conversation_user_id IN (
    SELECT public.get_organization_member_ids(_user_id)
  ) INTO v_in_org;

  -- Restriction flags (cheap EXISTS queries)
  SELECT public.member_has_instance_restriction(_user_id) INTO v_inst_restricted;
  SELECT public.member_has_meta_restriction(_user_id) INTO v_meta_restricted;

  -- Channel-specific access
  IF _instance_id IS NOT NULL THEN
    IF v_inst_restricted THEN
      SELECT _instance_id IN (
        SELECT public.get_member_instance_ids(_user_id)
      ) INTO v_inst_allowed;
      IF v_inst_allowed THEN RETURN true; END IF;
    ELSE
      IF v_in_org THEN RETURN true; END IF;
    END IF;
  END IF;

  IF _meta_phone_number_id IS NOT NULL THEN
    IF v_meta_restricted THEN
      SELECT _meta_phone_number_id IN (
        SELECT public.get_member_meta_phone_number_ids(_user_id)
      ) INTO v_meta_allowed;
      IF v_meta_allowed THEN RETURN true; END IF;
    ELSE
      IF v_in_org THEN RETURN true; END IF;
    END IF;
  END IF;

  -- Conversation with neither instance nor meta number: org membership only
  IF _instance_id IS NULL AND _meta_phone_number_id IS NULL THEN
    RETURN v_in_org;
  END IF;

  RETURN false;
END;
$$;

-- =====================================================================
-- 3. Repoint the SELECT policy on conversations so the planner sees the
--    auth.uid() as a STABLE expression and can evaluate the per-user
--    bits ONCE for the whole query.
--
--    Same access semantics as before.
-- =====================================================================
DROP POLICY IF EXISTS "Users can view organization conversations" ON public.conversations;
CREATE POLICY "Users can view organization conversations"
ON public.conversations
FOR SELECT
USING (
  public.can_access_conversation_channel(
    (SELECT auth.uid()),
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
    (SELECT auth.uid()),
    user_id,
    instance_id,
    meta_phone_number_id
  )
)
WITH CHECK (
  public.can_access_conversation_channel(
    (SELECT auth.uid()),
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
    (SELECT auth.uid()),
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
  (SELECT auth.uid()) = user_id
  AND public.can_access_conversation_channel(
    (SELECT auth.uid()),
    user_id,
    instance_id,
    meta_phone_number_id
  )
);

-- Same trick for inbox_messages (uses can_access_conversation)
DROP POLICY IF EXISTS "Users can view organization messages" ON public.inbox_messages;
CREATE POLICY "Users can view organization messages"
ON public.inbox_messages
FOR SELECT
USING (
  public.can_access_conversation((SELECT auth.uid()), conversation_id)
);

DROP POLICY IF EXISTS "Users can update their own messages" ON public.inbox_messages;
CREATE POLICY "Users can update their own messages"
ON public.inbox_messages
FOR UPDATE
USING (
  public.can_access_conversation((SELECT auth.uid()), conversation_id)
)
WITH CHECK (
  public.can_access_conversation((SELECT auth.uid()), conversation_id)
);

DROP POLICY IF EXISTS "Users can create their own messages" ON public.inbox_messages;
CREATE POLICY "Users can create their own messages"
ON public.inbox_messages
FOR INSERT
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND public.can_access_conversation((SELECT auth.uid()), conversation_id)
);

-- =====================================================================
-- 4. Indexes to make the Inbox ordering / filters cheap on a 8k+ table.
-- =====================================================================

-- Default Inbox ordering: is_pinned DESC, last_message_at DESC
CREATE INDEX IF NOT EXISTS idx_conversations_pinned_last_msg
  ON public.conversations (is_pinned DESC, last_message_at DESC);

-- Cheap lookups by instance + recency (filters by instance, my-instances)
CREATE INDEX IF NOT EXISTS idx_conversations_instance_last_msg
  ON public.conversations (instance_id, last_message_at DESC);

-- Cheap lookups by meta number + recency
CREATE INDEX IF NOT EXISTS idx_conversations_meta_last_msg
  ON public.conversations (meta_phone_number_id, last_message_at DESC)
  WHERE meta_phone_number_id IS NOT NULL;

-- "Não lidas" tab
CREATE INDEX IF NOT EXISTS idx_conversations_unread
  ON public.conversations (last_message_at DESC)
  WHERE unread_count > 0 AND status <> 'archived';

-- "Arquivadas" tab
CREATE INDEX IF NOT EXISTS idx_conversations_status_last_msg
  ON public.conversations (status, last_message_at DESC);

-- Per-owner recency (used by older queries / org owners with many convs)
CREATE INDEX IF NOT EXISTS idx_conversations_user_last_msg
  ON public.conversations (user_id, last_message_at DESC);
