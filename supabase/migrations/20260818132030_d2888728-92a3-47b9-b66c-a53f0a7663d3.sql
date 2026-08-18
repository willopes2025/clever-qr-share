WITH synced AS (
  SELECT conversation_id, count(*) AS n
  FROM inbox_messages
  WHERE created_at >= now() - interval '14 hours'
    AND direction = 'inbound'
  GROUP BY conversation_id
)
UPDATE conversations c
SET unread_count = GREATEST(COALESCE(c.unread_count,0), s.n),
    updated_at = now()
FROM synced s
WHERE c.id = s.conversation_id
  AND COALESCE(c.unread_count,0) < s.n;