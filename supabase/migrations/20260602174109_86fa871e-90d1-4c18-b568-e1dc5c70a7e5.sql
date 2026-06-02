UPDATE storage.objects
SET metadata = jsonb_set(
  jsonb_set(COALESCE(metadata, '{}'::jsonb), '{mimetype}', '"audio/ogg"'),
  '{contentType}', '"audio/ogg"'
)
WHERE bucket_id = 'inbox-media'
  AND name LIKE '%voice-resent.ogg';