CREATE OR REPLACE FUNCTION public.get_whatsapp_message_stats(p_start timestamptz, p_end timestamptz)
RETURNS TABLE(sent bigint, delivered bigint, failed bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::bigint AS sent,
    COUNT(*) FILTER (WHERE status IN ('sent','delivered','received','read'))::bigint AS delivered,
    COUNT(*) FILTER (WHERE status = 'failed')::bigint AS failed
  FROM inbox_messages
  WHERE direction = 'outbound'
    AND created_at >= p_start
    AND created_at <= p_end;
$$;

GRANT EXECUTE ON FUNCTION public.get_whatsapp_message_stats(timestamptz, timestamptz) TO authenticated, anon;