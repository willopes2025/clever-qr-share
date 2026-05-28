CREATE OR REPLACE FUNCTION public.get_login_history(_days int DEFAULT 1)
RETURNS TABLE(
  event_time timestamptz,
  user_id uuid,
  email text,
  full_name text,
  ip_address text,
  provider text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    a.created_at AS event_time,
    (a.payload->>'actor_id')::uuid AS user_id,
    a.payload->'traits'->>'actor_username' AS email,
    a.payload->'traits'->>'actor_name' AS full_name,
    a.ip_address::text AS ip_address,
    a.payload->'traits'->>'provider' AS provider
  FROM auth.audit_log_entries a
  WHERE a.payload->>'action' = 'login'
    AND a.created_at >= now() - (_days || ' days')::interval
    AND public.has_role(auth.uid(), 'admin'::app_role)
  ORDER BY a.created_at DESC
$$;

GRANT EXECUTE ON FUNCTION public.get_login_history(int) TO authenticated;