-- Reset unread_count to 0 for all conversations where last message was outbound
-- These are stale/inconsistent counts from messages that were already responded to
UPDATE conversations 
SET unread_count = 0 
WHERE unread_count > 0 
AND last_message_direction = 'outbound';

-- Also reset very old conversations (inactive for 10+ days) with high unread counts
-- These are likely from before the fix was applied
UPDATE conversations 
SET unread_count = 0 
WHERE unread_count > 0 
AND last_message_at < NOW() - INTERVAL '10 days' 
AND status != 'open';