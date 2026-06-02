ALTER TABLE public.conversation_analysis_reports
  ADD COLUMN IF NOT EXISTS user_performance jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS funnel_performance jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS campaign_performance jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sla_performance jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS analysis_scope jsonb NOT NULL DEFAULT '{}'::jsonb;