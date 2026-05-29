
INSERT INTO storage.buckets (id, name, public) VALUES ('form-assets', 'form-assets', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view form assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'form-assets');

CREATE POLICY "Authenticated users can upload form assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'form-assets');

CREATE POLICY "Authenticated users can update form assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'form-assets');

CREATE POLICY "Authenticated users can delete form assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'form-assets');
