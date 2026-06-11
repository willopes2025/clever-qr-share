CREATE TABLE public.scheduled_analysis_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('daily','weekly','biweekly','monthly')),
  send_time time NOT NULL DEFAULT '08:00',
  recipient_user_ids uuid[] NOT NULL DEFAULT '{}',
  include_campaigns boolean NOT NULL DEFAULT true,
  include_sla boolean NOT NULL DEFAULT true,
  transcribe_audios boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX scheduled_analysis_reports_due_idx
  ON public.scheduled_analysis_reports (next_run_at)
  WHERE is_active = true;

CREATE INDEX scheduled_analysis_reports_org_idx
  ON public.scheduled_analysis_reports (organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_analysis_reports TO authenticated;
GRANT ALL ON public.scheduled_analysis_reports TO service_role;

ALTER TABLE public.scheduled_analysis_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view scheduled analysis reports"
ON public.scheduled_analysis_reports
FOR SELECT TO authenticated
USING (
  organization_id IN (
    SELECT o.id FROM public.organizations o
    WHERE o.owner_id = auth.uid()
    UNION
    SELECT tm.organization_id FROM public.team_members tm
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
);

CREATE POLICY "Org members can insert scheduled analysis reports"
ON public.scheduled_analysis_reports
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND organization_id IN (
    SELECT o.id FROM public.organizations o
    WHERE o.owner_id = auth.uid()
    UNION
    SELECT tm.organization_id FROM public.team_members tm
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
);

CREATE POLICY "Org members can update scheduled analysis reports"
ON public.scheduled_analysis_reports
FOR UPDATE TO authenticated
USING (
  organization_id IN (
    SELECT o.id FROM public.organizations o
    WHERE o.owner_id = auth.uid()
    UNION
    SELECT tm.organization_id FROM public.team_members tm
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
);

CREATE POLICY "Org members can delete scheduled analysis reports"
ON public.scheduled_analysis_reports
FOR DELETE TO authenticated
USING (
  organization_id IN (
    SELECT o.id FROM public.organizations o
    WHERE o.owner_id = auth.uid()
    UNION
    SELECT tm.organization_id FROM public.team_members tm
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
);

CREATE TRIGGER scheduled_analysis_reports_updated_at
BEFORE UPDATE ON public.scheduled_analysis_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();