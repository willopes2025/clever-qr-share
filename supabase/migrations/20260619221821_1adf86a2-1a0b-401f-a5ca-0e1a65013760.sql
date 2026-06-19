DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Org members can read buyer report PDFs'
  ) THEN
    CREATE POLICY "Org members can read buyer report PDFs"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'buyer-reports'
      AND EXISTS (
        SELECT 1
        FROM public.organizations o
        WHERE o.id::text = (storage.foldername(name))[1]
          AND (
            o.owner_id = auth.uid()
            OR EXISTS (
              SELECT 1
              FROM public.team_members tm
              WHERE tm.organization_id = o.id
                AND tm.user_id = auth.uid()
                AND tm.status = 'active'
            )
          )
      )
    );
  END IF;
END $$;