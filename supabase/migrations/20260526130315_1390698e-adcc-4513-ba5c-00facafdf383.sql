CREATE OR REPLACE FUNCTION public.can_access_conversation_channel(_user_id uuid, _conversation_user_id uuid, _instance_id uuid, _meta_phone_number_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_in_org boolean;
  v_inst_restricted boolean;
  v_meta_restricted boolean;
  v_inst_allowed boolean;
  v_meta_allowed boolean;
BEGIN
  SELECT _conversation_user_id IN (
    SELECT public.get_organization_member_ids(_user_id)
  ) INTO v_in_org;

  SELECT public.member_has_instance_restriction(_user_id) INTO v_inst_restricted;
  SELECT public.member_has_meta_restriction(_user_id) INTO v_meta_restricted;

  IF _instance_id IS NOT NULL THEN
    IF v_inst_restricted THEN
      SELECT _instance_id IN (
        SELECT public.get_member_instance_ids(_user_id)
      ) INTO v_inst_allowed;
      IF v_inst_allowed THEN RETURN true; END IF;
    ELSE
      IF v_in_org THEN RETURN true; END IF;
    END IF;
  END IF;

  IF _meta_phone_number_id IS NOT NULL THEN
    IF v_meta_restricted THEN
      SELECT _meta_phone_number_id IN (
        SELECT public.get_member_meta_phone_number_ids(_user_id)
      ) INTO v_meta_allowed;
      IF v_meta_allowed THEN RETURN true; END IF;
    ELSE
      IF v_in_org THEN RETURN true; END IF;
    END IF;
  END IF;

  -- Conversation with neither instance nor meta number:
  -- If user has any channel restriction, only the owner sees it.
  -- Otherwise (admins/owners), org membership is enough.
  IF _instance_id IS NULL AND _meta_phone_number_id IS NULL THEN
    IF v_inst_restricted OR v_meta_restricted THEN
      RETURN _conversation_user_id = _user_id;
    END IF;
    RETURN v_in_org;
  END IF;

  RETURN false;
END;
$function$;