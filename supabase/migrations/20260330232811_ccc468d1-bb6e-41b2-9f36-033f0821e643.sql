
-- Add new trigger types to the enum
ALTER TYPE funnel_trigger_type ADD VALUE IF NOT EXISTS 'on_responsible_changed';
ALTER TYPE funnel_trigger_type ADD VALUE IF NOT EXISTS 'on_scheduled_before_date_field';
ALTER TYPE funnel_trigger_type ADD VALUE IF NOT EXISTS 'on_scheduled_exact_time';
ALTER TYPE funnel_trigger_type ADD VALUE IF NOT EXISTS 'on_scheduled_daily';
ALTER TYPE funnel_trigger_type ADD VALUE IF NOT EXISTS 'on_conversation_closed';
ALTER TYPE funnel_trigger_type ADD VALUE IF NOT EXISTS 'on_hours_after_last_message';

-- Create automation execution log for deduplication of scheduled triggers
CREATE TABLE IF NOT EXISTS public.automation_execution_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES public.funnel_automations(id) ON DELETE CASCADE NOT NULL,
  deal_id uuid REFERENCES public.funnel_deals(id) ON DELETE CASCADE NOT NULL,
  executed_at timestamptz DEFAULT now(),
  trigger_key text NOT NULL,
  UNIQUE(automation_id, deal_id, trigger_key)
);

ALTER TABLE public.automation_execution_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their automation logs" ON public.automation_execution_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.funnel_automations fa
      JOIN public.funnels f ON fa.funnel_id = f.id
      WHERE fa.id = automation_execution_log.automation_id
      AND f.user_id = (SELECT auth.uid())
    )
  );
