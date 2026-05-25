CREATE OR REPLACE FUNCTION public.get_overview_metrics(p_start timestamp with time zone, p_end timestamp with time zone)
RETURNS TABLE(
  leads_today bigint,
  active_conversations bigint,
  auto_attendances bigint,
  human_attendances bigint,
  unanswered_leads bigint,
  responded_conversations bigint,
  avg_first_response_seconds numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH org_users AS (
    SELECT uid FROM public.get_organization_member_ids(auth.uid()) AS uid
  ),
  first_inbound AS (
    SELECT im.conversation_id, MIN(COALESCE(im.sent_at, im.created_at)) AS first_in
    FROM public.inbox_messages im
    JOIN public.conversations c ON c.id = im.conversation_id
    WHERE im.direction = 'inbound'
      AND COALESCE(im.sent_at, im.created_at) >= p_start
      AND COALESCE(im.sent_at, im.created_at) <= p_end
      AND c.user_id IN (SELECT uid FROM org_users)
    GROUP BY im.conversation_id
  ),
  first_response AS (
    SELECT fi.conversation_id,
           EXTRACT(EPOCH FROM (MIN(COALESCE(im.sent_at, im.created_at)) - fi.first_in)) AS resp_seconds
    FROM first_inbound fi
    JOIN public.inbox_messages im ON im.conversation_id = fi.conversation_id
    WHERE im.direction = 'outbound'
      AND COALESCE(im.sent_at, im.created_at) > fi.first_in
      AND COALESCE(im.sent_at, im.created_at) <= p_end
    GROUP BY fi.conversation_id, fi.first_in
  )
  SELECT
    (SELECT COUNT(*)::bigint FROM public.contacts
       WHERE user_id IN (SELECT uid FROM org_users)
         AND created_at >= p_start AND created_at <= p_end),
    (SELECT COUNT(*)::bigint FROM public.conversations
       WHERE user_id IN (SELECT uid FROM org_users)
         AND status = 'open'
         AND last_message_at >= p_start AND last_message_at <= p_end),
    (SELECT COUNT(*)::bigint FROM public.conversations
       WHERE user_id IN (SELECT uid FROM org_users)
         AND ai_handled = true
         AND created_at >= p_start AND created_at <= p_end),
    (SELECT COUNT(*)::bigint FROM public.conversations
       WHERE user_id IN (SELECT uid FROM org_users)
         AND ai_handled = false
         AND created_at >= p_start AND created_at <= p_end),
    (SELECT COUNT(*)::bigint FROM public.conversations
       WHERE user_id IN (SELECT uid FROM org_users)
         AND status = 'open'
         AND unread_count > 0
         AND last_message_at >= p_start AND last_message_at <= p_end),
    (SELECT COUNT(DISTINCT im.conversation_id)::bigint
       FROM public.inbox_messages im
       JOIN public.conversations c ON c.id = im.conversation_id
       WHERE im.direction = 'outbound'
         AND c.user_id IN (SELECT uid FROM org_users)
         AND COALESCE(im.sent_at, im.created_at) >= p_start
         AND COALESCE(im.sent_at, im.created_at) <= p_end),
    (SELECT COALESCE(AVG(resp_seconds), 0)::numeric FROM first_response WHERE resp_seconds >= 0 AND resp_seconds < 86400);
$$;