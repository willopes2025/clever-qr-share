CREATE TABLE public.user_inbox_hidden_instances (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, instance_id)
);

CREATE INDEX idx_user_inbox_hidden_instances_user
  ON public.user_inbox_hidden_instances (user_id);

ALTER TABLE public.user_inbox_hidden_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own inbox hidden instances"
  ON public.user_inbox_hidden_instances
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own inbox hidden instances"
  ON public.user_inbox_hidden_instances
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own inbox hidden instances"
  ON public.user_inbox_hidden_instances
  FOR DELETE
  USING (auth.uid() = user_id);