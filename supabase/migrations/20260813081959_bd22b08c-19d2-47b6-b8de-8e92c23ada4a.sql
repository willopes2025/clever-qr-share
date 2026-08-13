CREATE OR REPLACE FUNCTION public.is_account_active(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_id uuid;
  _member_status text;
  _sub_status text;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT tm.status INTO _member_status
  FROM public.team_members tm
  WHERE tm.user_id = _user_id
  LIMIT 1;

  IF _member_status = 'inactive' THEN
    RETURN false;
  END IF;

  SELECT o.owner_id INTO _owner_id
  FROM public.team_members tm
  JOIN public.organizations o ON o.id = tm.organization_id
  WHERE tm.user_id = _user_id
  LIMIT 1;

  IF _owner_id IS NULL THEN
    SELECT o.owner_id INTO _owner_id
    FROM public.organizations o
    WHERE o.owner_id = _user_id
    LIMIT 1;
  END IF;

  _owner_id := COALESCE(_owner_id, _user_id);

  SELECT s.status INTO _sub_status
  FROM public.subscriptions s
  WHERE s.user_id = _owner_id
  ORDER BY s.updated_at DESC NULLS LAST
  LIMIT 1;

  IF _sub_status IS NULL THEN
    RETURN true;
  END IF;

  RETURN _sub_status IN ('active', 'trialing');
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_account_active(uuid) TO authenticated, anon, service_role;