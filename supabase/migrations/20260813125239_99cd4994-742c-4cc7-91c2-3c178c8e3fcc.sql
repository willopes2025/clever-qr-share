CREATE TABLE public.impersonation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_email text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

GRANT SELECT ON public.impersonation_log TO authenticated;
GRANT ALL ON public.impersonation_log TO service_role;

ALTER TABLE public.impersonation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System owners can view impersonation logs"
ON public.impersonation_log
FOR SELECT
TO authenticated
USING (public.is_system_owner(auth.uid()));

CREATE INDEX idx_impersonation_log_actor ON public.impersonation_log(actor_user_id, started_at DESC);