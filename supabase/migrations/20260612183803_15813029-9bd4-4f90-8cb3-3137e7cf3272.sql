
CREATE TABLE public.lid_resolution_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  label_id text NOT NULL,
  instance_id uuid REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  last_error text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX lid_resolution_queue_contact_uidx
  ON public.lid_resolution_queue(contact_id);
CREATE INDEX lid_resolution_queue_pending_idx
  ON public.lid_resolution_queue(resolved_at, attempts)
  WHERE resolved_at IS NULL;

GRANT SELECT ON public.lid_resolution_queue TO authenticated;
GRANT ALL    ON public.lid_resolution_queue TO service_role;

ALTER TABLE public.lid_resolution_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view LID queue"
  ON public.lid_resolution_queue
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER lid_resolution_queue_updated_at
BEFORE UPDATE ON public.lid_resolution_queue
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
