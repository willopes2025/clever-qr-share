
-- Restrict all storage.objects on the dynamic-reports bucket to organization members.
-- Path convention (enforced by the edge function): org/<organization_id>/<report_id>/<run_id>.pdf

CREATE POLICY "dynamic_reports_read_org" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'dynamic-reports'
    AND (
      (storage.foldername(name))[1] = 'org'
      AND (
        (storage.foldername(name))[2]::uuid IN (
          SELECT org_id FROM (
            SELECT id AS org_id FROM public.organizations WHERE owner_id = auth.uid()
            UNION
            SELECT organization_id AS org_id FROM public.team_members
              WHERE user_id = auth.uid() AND status = 'active'
          ) o
        )
      )
    )
  );
