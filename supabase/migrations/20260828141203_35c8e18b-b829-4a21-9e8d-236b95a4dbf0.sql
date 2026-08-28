SELECT cron.unschedule('gestao-parts-orcamentos-job') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'gestao-parts-orcamentos-job'
);

SELECT cron.schedule(
  'gestao-parts-orcamentos-job',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://fgbenetdksqnvwkgnips.supabase.co/functions/v1/gestao-parts-orcamentos-job',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnYmVuZXRka3NxbnZ3a2duaXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3Mzg1MjksImV4cCI6MjA3OTMxNDUyOX0.V2rhtyEt2VSO7O2BqZELTGkFOX9p8onqNWSe3aazgaM'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.unschedule('inbox-sla-release') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'inbox-sla-release'
);

SELECT cron.schedule(
  'inbox-sla-release',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://fgbenetdksqnvwkgnips.supabase.co/functions/v1/inbox-sla-release',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnYmVuZXRka3NxbnZ3a2duaXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3Mzg1MjksImV4cCI6MjA3OTMxNDUyOX0.V2rhtyEt2VSO7O2BqZELTGkFOX9p8onqNWSe3aazgaM'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);