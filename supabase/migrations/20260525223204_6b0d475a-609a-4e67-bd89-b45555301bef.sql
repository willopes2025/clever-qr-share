ALTER TABLE public.ai_agent_configs
ADD COLUMN IF NOT EXISTS task_notify_user_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];