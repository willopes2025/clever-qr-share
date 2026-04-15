
UPDATE billing_reminders 
SET status = 'pending', error_message = NULL, updated_at = now()
WHERE scheduled_for::date = '2026-04-15'
  AND user_id = 'b3e1967e-cd4c-4835-8b3c-df65740a4fb9'
  AND status = 'skipped'
  AND error_message = 'Contact phone not found';
