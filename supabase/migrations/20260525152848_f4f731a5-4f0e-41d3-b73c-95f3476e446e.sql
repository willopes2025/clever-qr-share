
-- 1) Lock service-role policies to service_role only
DROP POLICY IF EXISTS "Service role can manage all webhook logs" ON public.ai_agent_webhook_logs;
CREATE POLICY "Service role can manage all webhook logs" ON public.ai_agent_webhook_logs
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage all AI calls" ON public.ai_phone_calls;
CREATE POLICY "Service role can manage all AI calls" ON public.ai_phone_calls
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage notification queue" ON public.notification_queue;
CREATE POLICY "Service role can manage notification queue" ON public.notification_queue
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage lead usage" ON public.lead_usage_log;
CREATE POLICY "Service role can manage lead usage" ON public.lead_usage_log
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage all sla_metrics" ON public.sla_metrics;
CREATE POLICY "Service role can manage all sla_metrics" ON public.sla_metrics
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2) Prevent privilege escalation on subscriptions
DROP POLICY IF EXISTS "Users can update their own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can insert their own subscription" ON public.subscriptions;

-- 3) Fix broken self-referential SELECT policy on internal_chat_groups
DROP POLICY IF EXISTS "Members can view their groups" ON public.internal_chat_groups;
CREATE POLICY "Members can view their groups" ON public.internal_chat_groups
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    public.is_internal_chat_group_member(id, auth.uid())
    OR auth.uid() = created_by
  );
