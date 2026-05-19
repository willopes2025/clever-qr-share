CREATE OR REPLACE FUNCTION public.get_whatsapp_message_stats(p_start timestamp with time zone, p_end timestamp with time zone)
RETURNS TABLE(sent bigint, delivered bigint, failed bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH org_users AS (
    SELECT public.get_organization_member_ids(auth.uid()) AS uid
  )
  SELECT
    COUNT(*)::bigint AS sent,
    COUNT(*) FILTER (WHERE im.status IN ('sent','delivered','received','read'))::bigint AS delivered,
    COUNT(*) FILTER (WHERE im.status = 'failed')::bigint AS failed
  FROM inbox_messages im
  JOIN conversations c ON c.id = im.conversation_id
  WHERE im.direction = 'outbound'
    AND im.created_at >= p_start
    AND im.created_at <= p_end
    AND c.user_id IN (SELECT uid FROM org_users);
$function$;