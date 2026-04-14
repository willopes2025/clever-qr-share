
CREATE TABLE public.scheduled_automation_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id UUID NOT NULL REFERENCES public.funnel_automations(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES public.funnel_deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  execute_at TIMESTAMPTZ NOT NULL,
  trigger_data JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheduled_auto_exec_pending ON public.scheduled_automation_executions (execute_at) WHERE status = 'pending';
CREATE INDEX idx_scheduled_auto_exec_automation ON public.scheduled_automation_executions (automation_id);

ALTER TABLE public.scheduled_automation_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scheduled executions"
ON public.scheduled_automation_executions FOR SELECT
TO authenticated
USING (user_id IN (SELECT get_organization_member_ids(auth.uid())));

CREATE POLICY "Users can insert own scheduled executions"
ON public.scheduled_automation_executions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scheduled executions"
ON public.scheduled_automation_executions FOR UPDATE
TO authenticated
USING (user_id IN (SELECT get_organization_member_ids(auth.uid())));

CREATE POLICY "Service role full access scheduled executions"
ON public.scheduled_automation_executions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
