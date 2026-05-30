
CREATE OR REPLACE FUNCTION public.apply_team_group_to_member(_member_id uuid, _group_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_group_org_id uuid;
  v_caller_is_owner boolean;
  v_member_user_id uuid;
  v_member_is_owner boolean;
BEGIN
  SELECT organization_id, user_id INTO v_org_id, v_member_user_id
  FROM public.team_members WHERE id = _member_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF _group_id IS NOT NULL THEN
    SELECT organization_id INTO v_group_org_id FROM public.team_groups WHERE id = _group_id;
    IF v_group_org_id IS NULL OR v_group_org_id <> v_org_id THEN
      RAISE EXCEPTION 'Team group does not belong to this organization';
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.organizations WHERE id = v_org_id AND owner_id = auth.uid()
  ) INTO v_caller_is_owner;

  IF NOT v_caller_is_owner THEN
    RAISE EXCEPTION 'Only the organization owner can apply team groups';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.organizations WHERE id = v_org_id AND owner_id = v_member_user_id
  ) INTO v_member_is_owner;

  IF v_member_is_owner THEN
    -- Never restrict the organization owner. Detach group + ensure no channel restrictions.
    UPDATE public.team_members SET team_group_id = NULL WHERE id = _member_id;
    DELETE FROM public.team_member_instances WHERE team_member_id = _member_id;
    DELETE FROM public.team_member_meta_numbers WHERE team_member_id = _member_id;
    RETURN;
  END IF;

  IF _group_id IS NULL THEN
    UPDATE public.team_members SET team_group_id = NULL WHERE id = _member_id;
    RETURN;
  END IF;

  UPDATE public.team_members
  SET permissions = (SELECT permissions FROM public.team_groups WHERE id = _group_id),
      team_group_id = _group_id
  WHERE id = _member_id;

  DELETE FROM public.team_member_instances WHERE team_member_id = _member_id;
  INSERT INTO public.team_member_instances (team_member_id, instance_id)
  SELECT _member_id, instance_id FROM public.team_group_instances WHERE team_group_id = _group_id;

  DELETE FROM public.team_member_meta_numbers WHERE team_member_id = _member_id;
  INSERT INTO public.team_member_meta_numbers (team_member_id, meta_number_id)
  SELECT _member_id, meta_number_id FROM public.team_group_meta_numbers WHERE team_group_id = _group_id;
END;
$function$;

-- Hard guard: prevent any insert of channel restrictions for an org owner
CREATE OR REPLACE FUNCTION public.prevent_owner_channel_restriction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_owner boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm
    JOIN public.organizations o ON o.id = tm.organization_id
    WHERE tm.id = NEW.team_member_id
      AND o.owner_id = tm.user_id
  ) INTO v_is_owner;

  IF v_is_owner THEN
    RAISE NOTICE 'Skipping channel restriction insert for organization owner (team_member_id=%)', NEW.team_member_id;
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_owner_inst_restriction ON public.team_member_instances;
CREATE TRIGGER trg_prevent_owner_inst_restriction
BEFORE INSERT ON public.team_member_instances
FOR EACH ROW EXECUTE FUNCTION public.prevent_owner_channel_restriction();

DROP TRIGGER IF EXISTS trg_prevent_owner_meta_restriction ON public.team_member_meta_numbers;
CREATE TRIGGER trg_prevent_owner_meta_restriction
BEFORE INSERT ON public.team_member_meta_numbers
FOR EACH ROW EXECUTE FUNCTION public.prevent_owner_channel_restriction();
