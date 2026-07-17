
CREATE OR REPLACE FUNCTION public.get_inbox_unread_count()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_count integer := 0;
  v_inst_restricted boolean;
  v_meta_restricted boolean;
BEGIN
  IF v_user IS NULL THEN
    RETURN 0;
  END IF;

  v_inst_restricted := public.member_has_instance_restriction(v_user);
  v_meta_restricted := public.member_has_meta_restriction(v_user);

  WITH accessible_users AS (
    SELECT uid FROM public.get_organization_member_ids(v_user) AS uid
  ),
  notif_instances AS (
    SELECT id FROM public.whatsapp_instances WHERE is_notification_only = true
  ),
  hidden_instances AS (
    SELECT instance_id FROM public.user_inbox_hidden_instances WHERE user_id = v_user
  ),
  warming_phones AS (
    SELECT regexp_replace(phone, '\D', '', 'g') AS p FROM public.warming_contacts WHERE phone IS NOT NULL
    UNION
    SELECT regexp_replace(phone_number, '\D', '', 'g') AS p FROM public.warming_pool WHERE phone_number IS NOT NULL
  ),
  member_inst AS (
    SELECT instance_id FROM public.get_member_instance_ids(v_user) AS instance_id
  ),
  member_meta AS (
    SELECT phone_number_id FROM public.get_member_meta_phone_number_ids(v_user) AS phone_number_id
  ),
  top_convs AS (
    SELECT c.id, c.instance_id, c.meta_phone_number_id, c.contact_id,
           c.last_message_preview, c.last_message_direction,
           c.unread_count, c.status
    FROM public.conversations c
    WHERE c.user_id IN (SELECT uid FROM accessible_users)
      AND (
        (c.instance_id IS NOT NULL AND (
          (v_inst_restricted AND c.instance_id IN (SELECT instance_id FROM member_inst))
          OR (NOT v_inst_restricted)
        ))
        OR (c.meta_phone_number_id IS NOT NULL AND (
          (v_meta_restricted AND c.meta_phone_number_id IN (SELECT phone_number_id FROM member_meta))
          OR (NOT v_meta_restricted)
        ))
        OR (c.instance_id IS NULL AND c.meta_phone_number_id IS NULL
            AND NOT v_inst_restricted AND NOT v_meta_restricted)
      )
    ORDER BY c.is_pinned DESC NULLS LAST, c.last_message_at DESC NULLS LAST
    LIMIT 200
  )
  SELECT COUNT(*)::int INTO v_count
  FROM top_convs t
  LEFT JOIN public.contacts ct ON ct.id = t.contact_id
  WHERE COALESCE(t.unread_count, 0) > 0
    AND COALESCE(t.status, '') <> 'archived'
    AND (t.instance_id IS NULL OR t.instance_id NOT IN (SELECT id FROM notif_instances))
    AND (t.instance_id IS NULL OR t.instance_id NOT IN (SELECT instance_id FROM hidden_instances))
    AND (
      t.last_message_preview IS NOT NULL
      OR t.last_message_direction IS NOT NULL
      OR COALESCE(btrim(ct.name), '') <> ''
    )
    AND (
      ct.phone IS NULL
      OR regexp_replace(ct.phone, '\D', '', 'g') NOT IN (SELECT p FROM warming_phones)
    );

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_inbox_unread_count() TO authenticated;
