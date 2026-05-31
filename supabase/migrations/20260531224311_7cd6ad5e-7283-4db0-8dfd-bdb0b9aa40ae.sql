CREATE OR REPLACE FUNCTION public.search_inbox_messages(_term text, _limit int DEFAULT 800)
RETURNS TABLE(conversation_id uuid, content text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH candidates AS (
    SELECT m.conversation_id, m.content, m.created_at,
      row_number() OVER (PARTITION BY m.conversation_id ORDER BY m.created_at DESC) AS rn
    FROM public.inbox_messages m
    WHERE m.content ILIKE '%' || _term || '%'
      AND public.can_access_conversation(auth.uid(), m.conversation_id)
    ORDER BY m.created_at DESC
    LIMIT 4000
  )
  SELECT c.conversation_id, c.content, c.created_at
  FROM candidates c
  WHERE c.rn = 1
  ORDER BY c.created_at DESC
  LIMIT _limit;
$$;

GRANT EXECUTE ON FUNCTION public.search_inbox_messages(text, int) TO authenticated;