CREATE TABLE IF NOT EXISTS public.gestao_parts_status_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL,
  contact_id uuid,
  from_stage_id uuid,
  stage_id uuid NOT NULL,
  status_text text,
  dedupe_key text NOT NULL,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS gestao_parts_status_queue_dedupe_uidx
  ON public.gestao_parts_status_queue (dedupe_key);
CREATE INDEX IF NOT EXISTS gestao_parts_status_queue_due_idx
  ON public.gestao_parts_status_queue (status, scheduled_at);

GRANT SELECT ON public.gestao_parts_status_queue TO authenticated;
GRANT ALL ON public.gestao_parts_status_queue TO service_role;

ALTER TABLE public.gestao_parts_status_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view status queue" ON public.gestao_parts_status_queue;
CREATE POLICY "Org members can view status queue"
ON public.gestao_parts_status_queue
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.funnel_deals d
    WHERE d.id = gestao_parts_status_queue.deal_id
      AND d.user_id IN (SELECT public.get_organization_member_ids(auth.uid()))
  )
);

DROP TRIGGER IF EXISTS set_gp_status_queue_updated_at ON public.gestao_parts_status_queue;
CREATE TRIGGER set_gp_status_queue_updated_at
BEFORE UPDATE ON public.gestao_parts_status_queue
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

SELECT cron.unschedule('gestao-parts-status-queue') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'gestao-parts-status-queue'
);

SELECT cron.schedule(
  'gestao-parts-status-queue',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://fgbenetdksqnvwkgnips.supabase.co/functions/v1/gestao-parts-status-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnYmVuZXRka3NxbnZ3a2duaXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3Mzg1MjksImV4cCI6MjA3OTMxNDUyOX0.V2rhtyEt2VSO7O2BqZELTGkFOX9p8onqNWSe3aazgaM'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);