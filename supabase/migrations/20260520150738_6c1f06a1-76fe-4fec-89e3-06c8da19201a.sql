CREATE OR REPLACE FUNCTION public.resolve_user_organization_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id
  FROM (
    SELECT tm.organization_id AS org_id, tm.joined_at AS sort_at
    FROM public.team_members tm
    WHERE tm.user_id = _user_id
      AND tm.status = 'active'
      AND tm.organization_id IS NOT NULL
    UNION ALL
    SELECT o.id AS org_id, o.created_at AS sort_at
    FROM public.organizations o
    WHERE o.owner_id = _user_id
  ) orgs
  ORDER BY sort_at DESC NULLS LAST
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.set_activity_session_organization_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.resolve_user_organization_id(NEW.user_id);
  END IF;

  IF NEW.last_activity IS NULL THEN
    NEW.last_activity := NEW.started_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_activity_session_organization_id_trigger ON public.user_activity_sessions;
CREATE TRIGGER set_activity_session_organization_id_trigger
BEFORE INSERT ON public.user_activity_sessions
FOR EACH ROW
EXECUTE FUNCTION public.set_activity_session_organization_id();

CREATE OR REPLACE FUNCTION public.set_performance_metrics_organization_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.resolve_user_organization_id(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_performance_metrics_organization_id_trigger ON public.user_performance_metrics;
CREATE TRIGGER set_performance_metrics_organization_id_trigger
BEFORE INSERT ON public.user_performance_metrics
FOR EACH ROW
EXECUTE FUNCTION public.set_performance_metrics_organization_id();

UPDATE public.user_activity_sessions uas
SET organization_id = public.resolve_user_organization_id(uas.user_id)
WHERE uas.organization_id IS NULL
  AND public.resolve_user_organization_id(uas.user_id) IS NOT NULL;

UPDATE public.user_performance_metrics upm
SET organization_id = public.resolve_user_organization_id(upm.user_id)
WHERE upm.organization_id IS NULL
  AND public.resolve_user_organization_id(upm.user_id) IS NOT NULL;

DROP POLICY IF EXISTS "Org members can view org sessions" ON public.user_activity_sessions;
CREATE POLICY "Org members can view org sessions"
ON public.user_activity_sessions
FOR SELECT
USING (
  organization_id IN (
    SELECT tm.organization_id
    FROM public.team_members tm
    WHERE tm.user_id = auth.uid()
      AND tm.status = 'active'
  )
  OR user_id IN (
    SELECT public.get_organization_member_ids(auth.uid())
  )
);