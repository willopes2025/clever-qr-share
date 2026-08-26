CREATE OR REPLACE FUNCTION public.can_access_conversation_channel(_user_id uuid, _conversation_user_id uuid, _instance_id uuid, _meta_phone_number_id text, _assigned_to uuid DEFAULT NULL::uuid)
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
  v_channel_ok boolean := false;
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
      IF v_inst_allowed THEN v_channel_ok := true; END IF;
    ELSE
      IF v_in_org THEN v_channel_ok := true; END IF;
    END IF;
  END IF;

  IF NOT v_channel_ok AND _meta_phone_number_id IS NOT NULL THEN
    IF v_meta_restricted THEN
      SELECT _meta_phone_number_id IN (
        SELECT public.get_member_meta_phone_number_ids(_user_id)
      ) INTO v_meta_allowed;
      IF v_meta_allowed THEN v_channel_ok := true; END IF;
    ELSE
      IF v_in_org THEN v_channel_ok := true; END IF;
    END IF;
  END IF;

  IF NOT v_channel_ok AND _instance_id IS NULL AND _meta_phone_number_id IS NULL THEN
    IF v_inst_restricted OR v_meta_restricted THEN
      v_channel_ok := (_conversation_user_id = _user_id);
    ELSE
      v_channel_ok := v_in_org;
    END IF;
  END IF;

  IF NOT v_channel_ok THEN
    RETURN false;
  END IF;

  -- Carteira: vendedor restrito enxerga o que é dele + o que ainda não tem dono
  -- (para poder assumir o cliente na aba "Sem responsável").
  IF public.member_is_wallet_only(_user_id) THEN
    RETURN _assigned_to IS NULL OR _assigned_to = _user_id;
  END IF;

  RETURN true;
END;
$function$;