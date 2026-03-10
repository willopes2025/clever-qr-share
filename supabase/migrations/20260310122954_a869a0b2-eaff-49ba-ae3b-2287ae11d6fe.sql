
-- Remove duplicate messages keeping the oldest for each whatsapp_message_id
DELETE FROM inbox_messages 
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY whatsapp_message_id 
      ORDER BY created_at ASC
    ) as rn
    FROM inbox_messages
    WHERE whatsapp_message_id IS NOT NULL
  ) sub WHERE rn > 1
);

-- Create unique partial index to prevent future duplicates
CREATE UNIQUE INDEX idx_inbox_messages_whatsapp_id_unique 
ON inbox_messages (whatsapp_message_id) 
WHERE whatsapp_message_id IS NOT NULL;
