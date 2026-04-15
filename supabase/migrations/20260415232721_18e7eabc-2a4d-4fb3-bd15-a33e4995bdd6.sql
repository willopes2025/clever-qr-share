
-- Create conversations and inbox messages for sent billing reminders without conversation_id
DO $$
DECLARE
  r RECORD;
  new_conv_id UUID;
BEGIN
  FOR r IN 
    SELECT br.id, br.contact_id, br.user_id, br.message_content, br.reminder_type, br.sent_at
    FROM billing_reminders br
    WHERE br.scheduled_for::date = '2026-04-15'
      AND br.user_id = 'b3e1967e-cd4c-4835-8b3c-df65740a4fb9'
      AND br.status = 'sent'
      AND br.sent_at >= '2026-04-15T23:19:00Z'
      AND br.conversation_id IS NULL
      AND br.contact_id IS NOT NULL
  LOOP
    -- Check if conversation already exists for this contact
    SELECT id INTO new_conv_id
    FROM conversations
    WHERE contact_id = r.contact_id AND user_id = r.user_id
    ORDER BY last_message_at DESC NULLS LAST
    LIMIT 1;

    -- Create conversation if not exists
    IF new_conv_id IS NULL THEN
      INSERT INTO conversations (contact_id, user_id, status, provider, meta_phone_number_id, last_message_at, last_message_preview, last_message_direction)
      VALUES (r.contact_id, r.user_id, 'open', 'meta', '1094594580394816', r.sent_at, LEFT(r.message_content, 100), 'outbound')
      RETURNING id INTO new_conv_id;
    ELSE
      UPDATE conversations SET last_message_at = r.sent_at, last_message_preview = LEFT(r.message_content, 100), last_message_direction = 'outbound'
      WHERE id = new_conv_id;
    END IF;

    -- Update billing reminder with conversation_id
    UPDATE billing_reminders SET conversation_id = new_conv_id WHERE id = r.id;

    -- Insert inbox message
    INSERT INTO inbox_messages (conversation_id, user_id, direction, content, message_type, status, sent_at, sent_via_meta_number_id)
    VALUES (new_conv_id, r.user_id, 'outbound', r.message_content, 'template', 'sent', r.sent_at, '1094594580394816');
  END LOOP;
END $$;
