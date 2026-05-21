CREATE OR REPLACE FUNCTION public.get_whatsapp_message_stats_by_instance(
  p_start timestamptz,
  p_end timestamptz
)
RETURNS TABLE(
  instance_id text,
  instance_name text,
  sent bigint,
  delivered bigint,
  failed bigint,
  received bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH org_users AS (
    SELECT uid
    FROM public.get_organization_member_ids(auth.uid()) AS uid
  ),
  grouped AS (
    SELECT
      CASE
        WHEN c.provider = 'meta' AND c.meta_phone_number_id IS NOT NULL THEN 'meta:' || c.meta_phone_number_id
        WHEN c.instance_id IS NOT NULL THEN 'evo:' || c.instance_id::text
        ELSE NULL
      END AS chip_key,
      COUNT(*) FILTER (WHERE im.direction = 'outbound')::bigint AS sent,
      COUNT(*) FILTER (
        WHERE im.direction = 'outbound'
          AND im.status IN ('sent', 'delivered', 'received', 'read')
      )::bigint AS delivered,
      COUNT(*) FILTER (
        WHERE im.direction = 'outbound'
          AND im.status = 'failed'
      )::bigint AS failed,
      COUNT(*) FILTER (WHERE im.direction = 'inbound')::bigint AS received
    FROM public.inbox_messages im
    JOIN public.conversations c ON c.id = im.conversation_id
    WHERE im.created_at >= p_start
      AND im.created_at <= p_end
      AND c.user_id IN (SELECT uid FROM org_users)
      AND (
        (c.provider = 'meta' AND c.meta_phone_number_id IS NOT NULL)
        OR c.instance_id IS NOT NULL
      )
    GROUP BY chip_key
  )
  SELECT
    g.chip_key AS instance_id,
    CASE
      WHEN g.chip_key LIKE 'meta:%' THEN COALESCE('📱 ' || mn.display_name, 'Meta ' || right(replace(g.chip_key, 'meta:', ''), 4))
      ELSE COALESCE(wi.instance_name, 'Desconhecido')
    END AS instance_name,
    g.sent,
    g.delivered,
    g.failed,
    g.received
  FROM grouped g
  LEFT JOIN public.whatsapp_instances wi
    ON g.chip_key LIKE 'evo:%'
   AND wi.id = replace(g.chip_key, 'evo:', '')::uuid
  LEFT JOIN public.meta_whatsapp_numbers mn
    ON g.chip_key LIKE 'meta:%'
   AND mn.phone_number_id = replace(g.chip_key, 'meta:', '')
  WHERE g.chip_key IS NOT NULL
  ORDER BY (g.sent + g.received) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_whatsapp_message_stats_by_instance(timestamptz, timestamptz) TO authenticated;