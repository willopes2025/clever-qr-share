-- Add is_idle column to track 10min+ inactivity without ending session
ALTER TABLE public.user_activity_sessions
ADD COLUMN IF NOT EXISTS is_idle boolean NOT NULL DEFAULT false;

-- RPC to get messages sent grouped by hour (BRT) and user, for dashboard chart
CREATE OR REPLACE FUNCTION public.get_messages_by_hour(
  p_start timestamptz,
  p_end timestamptz,
  p_user_ids uuid[]
)
RETURNS TABLE(user_id uuid, hour integer, message_count bigint)
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
  )
  SELECT
    im.sent_by_user_id AS user_id,
    EXTRACT(HOUR FROM (COALESCE(im.sent_at, im.created_at) AT TIME ZONE 'America/Sao_Paulo'))::int AS hour,
    COUNT(*)::bigint AS message_count
  FROM public.inbox_messages im
  JOIN authorized_users au ON au.user_id = im.sent_by_user_id
  WHERE im.direction = 'outbound'
    AND COALESCE(im.sent_at, im.created_at) >= p_start
    AND COALESCE(im.sent_at, im.created_at) <= p_end
  GROUP BY im.sent_by_user_id, hour;
$$;