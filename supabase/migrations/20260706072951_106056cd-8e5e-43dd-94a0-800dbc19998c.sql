
-- 1) permission enum-friendly UI is client-side; no DB enum change needed for permissions.

-- 2) dynamic_reports
CREATE TABLE IF NOT EXISTS public.dynamic_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL CHECK (source IN ('contacts','deals','form_submissions','tags_stage')),
  filter_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  period_config JSONB NOT NULL DEFAULT '{"preset":"last_7d"}'::jsonb,
  columns TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  schedule_config JSONB NOT NULL DEFAULT '{"enabled":false}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dynamic_reports TO authenticated;
GRANT ALL ON public.dynamic_reports TO service_role;

ALTER TABLE public.dynamic_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dynamic_reports_org_read" ON public.dynamic_reports
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE POLICY "dynamic_reports_owner_insert" ON public.dynamic_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "dynamic_reports_org_update" ON public.dynamic_reports
  FOR UPDATE TO authenticated
  USING (user_id IN (SELECT public.get_organization_member_ids(auth.uid())))
  WITH CHECK (user_id IN (SELECT public.get_organization_member_ids(auth.uid())));

CREATE POLICY "dynamic_reports_owner_delete" ON public.dynamic_reports
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_dynamic_reports_user ON public.dynamic_reports(user_id);
CREATE INDEX idx_dynamic_reports_org ON public.dynamic_reports(organization_id);

-- 3) recipients
CREATE TABLE IF NOT EXISTS public.dynamic_report_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.dynamic_reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  channels TEXT[] NOT NULL DEFAULT ARRAY['bell']::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (report_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dynamic_report_recipients TO authenticated;
GRANT ALL ON public.dynamic_report_recipients TO service_role;

ALTER TABLE public.dynamic_report_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipients_read_org" ON public.dynamic_report_recipients
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.dynamic_reports r
    WHERE r.id = report_id
      AND r.user_id IN (SELECT public.get_organization_member_ids(auth.uid()))
  ));

CREATE POLICY "recipients_write_org" ON public.dynamic_report_recipients
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.dynamic_reports r
    WHERE r.id = report_id
      AND r.user_id IN (SELECT public.get_organization_member_ids(auth.uid()))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.dynamic_reports r
    WHERE r.id = report_id
      AND r.user_id IN (SELECT public.get_organization_member_ids(auth.uid()))
  ));

CREATE INDEX idx_report_recipients_user ON public.dynamic_report_recipients(user_id);

-- 4) runs
CREATE TABLE IF NOT EXISTS public.dynamic_report_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.dynamic_reports(id) ON DELETE CASCADE,
  triggered_by UUID,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  row_count INTEGER NOT NULL DEFAULT 0,
  pdf_storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success','failed')),
  error TEXT,
  delivery_log JSONB NOT NULL DEFAULT '[]'::jsonb
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dynamic_report_runs TO authenticated;
GRANT ALL ON public.dynamic_report_runs TO service_role;

ALTER TABLE public.dynamic_report_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "runs_read_org_or_recipient" ON public.dynamic_report_runs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dynamic_reports r
      WHERE r.id = report_id
        AND r.user_id IN (SELECT public.get_organization_member_ids(auth.uid()))
    )
    OR EXISTS (
      SELECT 1 FROM public.dynamic_report_recipients rr
      WHERE rr.report_id = report_id AND rr.user_id = auth.uid()
    )
  );

CREATE POLICY "runs_insert_service" ON public.dynamic_report_runs
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.dynamic_reports r
    WHERE r.id = report_id
      AND r.user_id IN (SELECT public.get_organization_member_ids(auth.uid()))
  ));

CREATE INDEX idx_report_runs_report ON public.dynamic_report_runs(report_id, executed_at DESC);

-- 5) updated_at trigger
CREATE TRIGGER trg_dynamic_reports_updated_at
  BEFORE UPDATE ON public.dynamic_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) auto-set organization_id if missing on insert
CREATE OR REPLACE FUNCTION public.set_dynamic_report_org()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.resolve_user_organization_id(NEW.user_id);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_dynamic_reports_org
  BEFORE INSERT ON public.dynamic_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_dynamic_report_org();

-- Enable realtime for runs so the UI can toast when a new run is inserted
ALTER PUBLICATION supabase_realtime ADD TABLE public.dynamic_report_runs;
