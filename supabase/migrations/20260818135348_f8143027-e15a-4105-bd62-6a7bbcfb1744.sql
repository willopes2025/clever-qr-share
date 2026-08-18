-- Merge duplicate conversation for phone 5519992868926 (Soul Muscle instance)
UPDATE inbox_messages SET conversation_id = '0d7478b3-6ed3-4a5b-b751-775d91d4b8e3'
WHERE conversation_id = '2b420891-b188-4a0c-a504-6b7cefad0326';

UPDATE conversations c SET
  last_message_at = (SELECT max(created_at) FROM inbox_messages m WHERE m.conversation_id = c.id),
  unread_count = (SELECT count(*) FROM inbox_messages m WHERE m.conversation_id = c.id AND m.direction = 'inbound'),
  status = 'active'
WHERE c.id = '0d7478b3-6ed3-4a5b-b751-775d91d4b8e3';

DELETE FROM conversations WHERE id = '2b420891-b188-4a0c-a504-6b7cefad0326';
DELETE FROM contacts WHERE id = '038d0184-2c26-4a5b-aeab-87463816ee71'
  AND NOT EXISTS (SELECT 1 FROM conversations cv WHERE cv.contact_id = contacts.id);