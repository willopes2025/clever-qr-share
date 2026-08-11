-- 1) Extend ai_agent_configs
ALTER TABLE public.ai_agent_configs
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS role_key text,
  ADD COLUMN IF NOT EXISTS objective text,
  ADD COLUMN IF NOT EXISTS not_allowed text,
  ADD COLUMN IF NOT EXISTS is_orchestrator boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS activation_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS allowed_tools text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS max_delegations smallint NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS max_tool_calls smallint NOT NULL DEFAULT 8;

UPDATE public.ai_agent_configs
SET organization_id = public.resolve_user_organization_id(user_id)
WHERE organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_agent_configs_org ON public.ai_agent_configs(organization_id);

-- 2) Transfer rules between agents
CREATE TABLE public.ai_agent_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_agent_id uuid NOT NULL REFERENCES public.ai_agent_configs(id) ON DELETE CASCADE,
  to_agent_id uuid NOT NULL REFERENCES public.ai_agent_configs(id) ON DELETE CASCADE,
  condition_text text,
  priority smallint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_agent_id, to_agent_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_agent_transfers TO authenticated;
GRANT ALL ON public.ai_agent_transfers TO service_role;
ALTER TABLE public.ai_agent_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members manage agent transfers" ON public.ai_agent_transfers
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid()))
  WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

-- 3) Knowledge sharing across agents
CREATE TABLE public.ai_agent_knowledge_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_config_id uuid NOT NULL REFERENCES public.ai_agent_configs(id) ON DELETE CASCADE,
  knowledge_item_id uuid NOT NULL REFERENCES public.ai_agent_knowledge_items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_config_id, knowledge_item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_agent_knowledge_links TO authenticated;
GRANT ALL ON public.ai_agent_knowledge_links TO service_role;
ALTER TABLE public.ai_agent_knowledge_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members manage knowledge links" ON public.ai_agent_knowledge_links
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid()))
  WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

-- 4) Memory
CREATE TABLE public.ai_agent_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'conversation',
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  agent_config_id uuid REFERENCES public.ai_agent_configs(id) ON DELETE SET NULL,
  memory_key text NOT NULL,
  content text NOT NULL,
  importance smallint NOT NULL DEFAULT 1,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_agent_memory_lookup
  ON public.ai_agent_memory(organization_id, scope, conversation_id, contact_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_agent_memory TO authenticated;
GRANT ALL ON public.ai_agent_memory TO service_role;
ALTER TABLE public.ai_agent_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members manage agent memory" ON public.ai_agent_memory
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid()))
  WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

CREATE OR REPLACE FUNCTION public.validate_ai_agent_memory()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.scope NOT IN ('conversation','contact','organization') THEN
    RAISE EXCEPTION 'invalid memory scope: %', NEW.scope;
  END IF;
  IF NEW.scope = 'conversation' AND NEW.conversation_id IS NULL THEN
    RAISE EXCEPTION 'conversation memory requires conversation_id';
  END IF;
  IF NEW.scope = 'contact' AND NEW.contact_id IS NULL THEN
    RAISE EXCEPTION 'contact memory requires contact_id';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_ai_agent_memory_trg
  BEFORE INSERT OR UPDATE ON public.ai_agent_memory
  FOR EACH ROW EXECUTE FUNCTION public.validate_ai_agent_memory();

-- 5) Execution logs
CREATE TABLE public.ai_execution_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  entry_agent_id uuid REFERENCES public.ai_agent_configs(id) ON DELETE SET NULL,
  final_agent_id uuid REFERENCES public.ai_agent_configs(id) ON DELETE SET NULL,
  incoming_message text,
  detected_intent text,
  final_response text,
  status text NOT NULL DEFAULT 'running',
  error_message text,
  duration_ms integer,
  total_tokens integer,
  estimated_cost numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_execution_runs_org_created
  ON public.ai_execution_runs(organization_id, created_at DESC);
GRANT SELECT ON public.ai_execution_runs TO authenticated;
GRANT ALL ON public.ai_execution_runs TO service_role;
ALTER TABLE public.ai_execution_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read execution runs" ON public.ai_execution_runs
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE TABLE public.ai_execution_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.ai_execution_runs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  step_index smallint NOT NULL DEFAULT 0,
  step_type text NOT NULL,
  agent_config_id uuid REFERENCES public.ai_agent_configs(id) ON DELETE SET NULL,
  label text,
  input_summary text,
  output_summary text,
  duration_ms integer,
  status text NOT NULL DEFAULT 'ok',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_execution_steps_run ON public.ai_execution_steps(run_id, step_index);
GRANT SELECT ON public.ai_execution_steps TO authenticated;
GRANT ALL ON public.ai_execution_steps TO service_role;
ALTER TABLE public.ai_execution_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read execution steps" ON public.ai_execution_steps
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid()));

-- 6) Skills
CREATE TABLE public.ai_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  skill_key text NOT NULL,
  name text NOT NULL,
  description text,
  instructions text,
  tools text[] NOT NULL DEFAULT '{}'::text[],
  config_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_builtin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_skills TO authenticated;
GRANT ALL ON public.ai_skills TO service_role;
ALTER TABLE public.ai_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read skills" ON public.ai_skills
  FOR SELECT TO authenticated
  USING (is_builtin OR organization_id = public.get_user_organization_id(auth.uid()));
CREATE POLICY "org members write skills" ON public.ai_skills
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));
CREATE POLICY "org members update skills" ON public.ai_skills
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid()))
  WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));
CREATE POLICY "org members delete skills" ON public.ai_skills
  FOR DELETE TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE TABLE public.ai_agent_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_config_id uuid NOT NULL REFERENCES public.ai_agent_configs(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.ai_skills(id) ON DELETE CASCADE,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_config_id, skill_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_agent_skills TO authenticated;
GRANT ALL ON public.ai_agent_skills TO service_role;
ALTER TABLE public.ai_agent_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members manage agent skills" ON public.ai_agent_skills
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid()))
  WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

-- updated_at triggers
CREATE TRIGGER update_ai_agent_transfers_updated_at BEFORE UPDATE ON public.ai_agent_transfers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ai_agent_memory_updated_at BEFORE UPDATE ON public.ai_agent_memory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ai_execution_runs_updated_at BEFORE UPDATE ON public.ai_execution_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ai_skills_updated_at BEFORE UPDATE ON public.ai_skills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();