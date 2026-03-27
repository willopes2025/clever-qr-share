
CREATE OR REPLACE FUNCTION public.get_member_meta_number_ids(_user_id uuid)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT tmmn.meta_number_id
  FROM team_member_meta_numbers tmmn
  JOIN team_members tm ON tm.id = tmmn.team_member_id
  WHERE tm.user_id = _user_id AND tm.status = 'active'
$$;

CREATE OR REPLACE FUNCTION public.member_has_meta_restriction(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM team_member_meta_numbers tmmn
    JOIN team_members tm ON tm.id = tmmn.team_member_id
    WHERE tm.user_id = _user_id AND tm.status = 'active'
  )
$$;
