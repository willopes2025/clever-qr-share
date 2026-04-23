UPDATE billing_reminders 
SET status = 'pending', error_message = NULL, scheduled_for = NOW() + INTERVAL '5 minutes'
WHERE status = 'skipped' 
  AND error_message LIKE '%não foi possível obter telefone%'
  AND scheduled_for >= NOW() - INTERVAL '7 days';