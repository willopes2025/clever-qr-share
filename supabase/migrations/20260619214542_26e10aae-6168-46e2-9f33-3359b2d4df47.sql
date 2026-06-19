
CREATE TABLE public.buyer_report_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  funnel_id uuid NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  name text NOT NULL,
  description text,
  prompt text NOT NULL,
  stage_ids uuid[] NOT NULL DEFAULT '{}',
  min_score smallint NOT NULL DEFAULT 60,
  max_leads smallint NOT NULL DEFAULT 50,
  lookback_days smallint NOT NULL DEFAULT 7,
  schedule_time text NOT NULL DEFAULT '08:00',
  schedule_days smallint[] NOT NULL DEFAULT ARRAY[1,2,3,4,5]::smallint[],
  enabled boolean NOT NULL DEFAULT true,
  manager_user_ids uuid[] NOT NULL DEFAULT '{}',
  send_to_assignee_whatsapp boolean NOT NULL DEFAULT false,
  whatsapp_instance_id uuid REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.buyer_report_objectives TO authenticated;
GRANT ALL ON public.buyer_report_objectives TO service_role;

ALTER TABLE public.buyer_report_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view objectives"
  ON public.buyer_report_objectives FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT o.id FROM public.organizations o
    WHERE o.owner_id = auth.uid()
       OR EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.organization_id = o.id AND tm.user_id = auth.uid() AND tm.status='active')
  ));

CREATE POLICY "Org owner can insert objectives"
  ON public.buyer_report_objectives FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.owner_id = auth.uid()));

CREATE POLICY "Org owner can update objectives"
  ON public.buyer_report_objectives FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.owner_id = auth.uid()));

CREATE POLICY "Org owner can delete objectives"
  ON public.buyer_report_objectives FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.owner_id = auth.uid()));

CREATE TRIGGER buyer_report_objectives_updated_at
  BEFORE UPDATE ON public.buyer_report_objectives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_bro_org ON public.buyer_report_objectives(organization_id);
CREATE INDEX idx_bro_next_run ON public.buyer_report_objectives(next_run_at) WHERE enabled = true;

CREATE TABLE public.buyer_report_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id uuid NOT NULL REFERENCES public.buyer_report_objectives(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  triggered_by uuid,
  executed_at timestamptz NOT NULL DEFAULT now(),
  leads_count integer NOT NULL DEFAULT 0,
  pdf_storage_path text,
  email_status text,
  whatsapp_status text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.buyer_report_runs TO authenticated;
GRANT ALL ON public.buyer_report_runs TO service_role;

ALTER TABLE public.buyer_report_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view runs"
  ON public.buyer_report_runs FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT o.id FROM public.organizations o
    WHERE o.owner_id = auth.uid()
       OR EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.organization_id = o.id AND tm.user_id = auth.uid() AND tm.status='active')
  ));

CREATE POLICY "Org owner can delete runs"
  ON public.buyer_report_runs FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.owner_id = auth.uid()));

CREATE INDEX idx_brr_objective ON public.buyer_report_runs(objective_id, executed_at DESC);
CREATE INDEX idx_brr_org ON public.buyer_report_runs(organization_id, executed_at DESC);
