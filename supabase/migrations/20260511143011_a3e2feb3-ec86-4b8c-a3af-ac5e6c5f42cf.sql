DELETE FROM conversations 
WHERE instance_id IS NULL 
  AND meta_phone_number_id IS NULL 
  AND user_id IN (
    SELECT user_id FROM team_members WHERE organization_id = '4533b774-445c-4d69-93d8-5460b903c1af' AND status='active' AND user_id IS NOT NULL
    UNION
    SELECT '56244cf5-9813-4e03-bdc0-7a79d5a3a9e3'::uuid
  );