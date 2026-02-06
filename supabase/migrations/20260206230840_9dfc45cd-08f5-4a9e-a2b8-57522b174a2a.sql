-- Add last_message_direction column to conversations table
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS last_message_direction text;

-- Backfill existing data based on the most recent message
UPDATE conversations c
SET last_message_direction = (
  SELECT direction 
  FROM inbox_messages 
  WHERE conversation_id = c.id 
  ORDER BY created_at DESC 
  LIMIT 1
)
WHERE last_message_direction IS NULL;