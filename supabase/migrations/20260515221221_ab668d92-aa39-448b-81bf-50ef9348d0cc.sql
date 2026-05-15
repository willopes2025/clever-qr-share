CREATE OR REPLACE FUNCTION public.get_member_message_productivity(
  p_start timestamptz,
  p_end timestamptz,
  p_user_ids uuid[]
)
RETURNS TABLE(
  user_id uuid,
  messages_sent bigint,
  messages_received bigint,
  characters_typed bigint,
  audios_sent bigint,
  media_sent bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH authorized_users AS (
    SELECT DISTINCT requested.user_id
    FROM unnest(p_user_ids) AS requested(user_id)
    WHERE EXISTS (
      SELECT 1
      FROM public.organizations o
      WHERE
        (
          o.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.team_members me
            WHERE me.organization_id = o.id
              AND me.user_id = auth.uid()
              AND me.status = 'active'
          )
        )
        AND (
          requested.user_id = o.owner_id
          OR EXISTS (
            SELECT 1
            FROM public.team_members tm
            WHERE tm.organization_id = o.id
              AND tm.user_id = requested.user_id
              AND tm.status = 'active'
          )
        )
    )
  ),
  outbound AS (
    SELECT
      im.sent_by_user_id AS user_id,
      COUNT(*)::bigint AS messages_sent,
      COALESCE(SUM(char_length(COALESCE(im.content, ''))), 0)::bigint AS characters_typed,
      COUNT(*) FILTER (WHERE im.message_type = 'audio')::bigint AS audios_sent,
      COUNT(*) FILTER (
        WHERE im.message_type IS NOT NULL
          AND im.message_type NOT IN ('text', 'audio')
      )::bigint AS media_sent
    FROM public.inbox_messages im
    JOIN authorized_users au ON au.user_id = im.sent_by_user_id
    WHERE im.direction = 'outbound'
      AND COALESCE(im.sent_at, im.created_at) >= p_start
      AND COALESCE(im.sent_at, im.created_at) <= p_end
    GROUP BY im.sent_by_user_id
  ),
  inbound AS (
    SELECT
      COALESCE(c.assigned_to, c.user_id) AS user_id,
      COUNT(*)::bigint AS messages_received
    FROM public.inbox_messages im
    JOIN public.conversations c ON c.id = im.conversation_id
    JOIN authorized_users au ON au.user_id = COALESCE(c.assigned_to, c.user_id)
    WHERE im.direction = 'inbound'
      AND COALESCE(im.sent_at, im.created_at) >= p_start
      AND COALESCE(im.sent_at, im.created_at) <= p_end
    GROUP BY COALESCE(c.assigned_to, c.user_id)
  )
  SELECT
    au.user_id,
    COALESCE(o.messages_sent, 0)::bigint AS messages_sent,
    COALESCE(i.messages_received, 0)::bigint AS messages_received,
    COALESCE(o.characters_typed, 0)::bigint AS characters_typed,
    COALESCE(o.audios_sent, 0)::bigint AS audios_sent,
    COALESCE(o.media_sent, 0)::bigint AS media_sent
  FROM authorized_users au
  LEFT JOIN outbound o ON o.user_id = au.user_id
  LEFT JOIN inbound i ON i.user_id = au.user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_member_message_productivity(timestamptz, timestamptz, uuid[]) TO authenticated;