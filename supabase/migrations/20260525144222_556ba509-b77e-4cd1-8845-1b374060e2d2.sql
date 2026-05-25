ALTER TABLE public.ai_agent_configs
ADD COLUMN IF NOT EXISTS task_creation_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS task_triggers text[] NOT NULL DEFAULT ARRAY['scheduling','handoff','followup','qualified_lead']::text[],
ADD COLUMN IF NOT EXISTS task_default_priority text NOT NULL DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS task_title_template text,
ADD COLUMN IF NOT EXISTS task_extra_instructions text;