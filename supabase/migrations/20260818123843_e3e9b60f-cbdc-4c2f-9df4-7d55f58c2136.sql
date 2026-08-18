CREATE OR REPLACE FUNCTION public.lease_message_sync_job(_job_id uuid, _lease_seconds integer, _batch_size integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  j public.message_sync_jobs%ROWTYPE;
BEGIN
  UPDATE public.message_sync_jobs
     SET status = 'running',
         lease_until = now() + make_interval(secs => _lease_seconds),
         updated_at = now()
   WHERE id = _job_id
     AND status IN ('pending','running')
     AND (lease_until IS NULL OR lease_until < now())
  RETURNING * INTO j;

  IF j.id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', j.id,
    'user_id', j.user_id,
    'instance_id', j.instance_id,
    'instance_name', j.instance_name,
    'evolution_instance_name', j.evolution_instance_name,
    'start_date', j.start_date,
    'total_chats', j.total_chats,
    'processed_chats', COALESCE(j.processed_chats, 0),
    'messages_imported', COALESCE(j.messages_imported, 0),
    'contacts_created', COALESCE(j.contacts_created, 0),
    'conversations_created', COALESCE(j.conversations_created, 0),
    'chats_with_errors', COALESCE(j.chats_with_errors, 0),
    'chats_slice', COALESCE((
      SELECT jsonb_agg(elem)
      FROM (
        SELECT elem
        FROM jsonb_array_elements(COALESCE(j.chats, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)
        WHERE t.ord > COALESCE(j.processed_chats, 0)
          AND t.ord <= COALESCE(j.processed_chats, 0) + _batch_size
        ORDER BY t.ord
      ) s
    ), '[]'::jsonb),
    'total_in_chats', jsonb_array_length(COALESCE(j.chats, '[]'::jsonb))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.lease_message_sync_job(uuid, integer, integer) TO service_role;