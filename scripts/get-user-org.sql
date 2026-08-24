-- Busca user_id e organization_id para criar a key
SELECT u.id as user_id, o.id as organization_id, u.email
FROM auth.users u
JOIN public.organizations o ON o.owner_id = u.id
LIMIT 1;
