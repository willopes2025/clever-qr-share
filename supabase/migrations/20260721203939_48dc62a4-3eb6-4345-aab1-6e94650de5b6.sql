
-- 1. Extra columns on email_templates
ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS design_json jsonb;

-- 2. Extra columns on email_campaigns
ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS design_json jsonb;

-- 3. Extra columns on email_messages to persist attachment metadata sent
ALTER TABLE public.email_messages
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 4. RLS policies on storage.objects for the email-attachments bucket
-- Path convention: <organization_id>/<uuid>-<filename>
DROP POLICY IF EXISTS "email_attachments_read_org" ON storage.objects;
CREATE POLICY "email_attachments_read_org"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'email-attachments'
    AND (
      -- org id is first path segment
      (storage.foldername(name))[1]::uuid = public.resolve_user_organization_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "email_attachments_insert_org" ON storage.objects;
CREATE POLICY "email_attachments_insert_org"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'email-attachments'
    AND (storage.foldername(name))[1]::uuid = public.resolve_user_organization_id(auth.uid())
  );

DROP POLICY IF EXISTS "email_attachments_delete_org" ON storage.objects;
CREATE POLICY "email_attachments_delete_org"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'email-attachments'
    AND (storage.foldername(name))[1]::uuid = public.resolve_user_organization_id(auth.uid())
  );
