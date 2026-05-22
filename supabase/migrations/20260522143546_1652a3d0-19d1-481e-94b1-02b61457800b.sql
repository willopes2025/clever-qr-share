-- Backfill inbox messages for the 4 already-sent campaign messages of "Disparo Oportunidades - Programa Seven"
-- that did not appear in inbox due to strict meta_phone_number_id matching.

WITH sent_msgs AS (
  SELECT cm.id, cm.contact_id, cm.message_content, cm.sent_at, cm.phone
  FROM campaign_messages cm
  WHERE cm.campaign_id = '67cf24de-51c7-4e44-ba1e-ae2c98b8ddcf'
    AND cm.status = 'sent'
),
upgraded_convs AS (
  UPDATE conversations c
  SET provider = 'meta',
      meta_phone_number_id = '1094594580394816',
      last_message_at = sm.sent_at,
      last_message_preview = LEFT(sm.message_content, 100),
      last_message_direction = 'outbound'
  FROM sent_msgs sm
  WHERE c.contact_id = sm.contact_id
    AND c.user_id = 'b3e1967e-cd4c-4835-8b3c-df65740a4fb9'
  RETURNING c.id AS conversation_id, c.contact_id
)
INSERT INTO inbox_messages (conversation_id, user_id, direction, content, message_type, status, sent_at, created_at)
SELECT uc.conversation_id,
       'b3e1967e-cd4c-4835-8b3c-df65740a4fb9',
       'outbound',
       sm.message_content,
       'template',
       'sent',
       sm.sent_at,
       sm.sent_at
FROM sent_msgs sm
JOIN upgraded_convs uc ON uc.contact_id = sm.contact_id;