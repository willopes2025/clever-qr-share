DROP POLICY IF EXISTS "Org members can read buyer report PDFs" ON storage.objects;

CREATE POLICY "Org members can read buyer report PDFs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'buyer-reports'
  AND EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id::text = (storage.foldername(storage.objects.name))[1]
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