-- 1) Controle de envio de orçamentos (idempotência)
CREATE TABLE public.gestao_parts_orcamento_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa text NOT NULL DEFAULT '',
  numero text NOT NULL,
  serie text,
  cliente_codigo text,
  cliente_nome text,
  telefone text,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  vendedor text,
  assigned_to uuid,
  total numeric,
  orcamento_emitido_em timestamptz,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  error_message text,
  message_content text,
  whatsapp_message_id text,
  origin text NOT NULL DEFAULT 'manual',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gestao_parts_orcamento_envios_unico UNIQUE (empresa, numero)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_parts_orcamento_envios TO authenticated;
GRANT ALL ON public.gestao_parts_orcamento_envios TO service_role;
ALTER TABLE public.gestao_parts_orcamento_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view orcamento envios"
ON public.gestao_parts_orcamento_envios FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Org members can insert orcamento envios"
ON public.gestao_parts_orcamento_envios FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Org members can update orcamento envios"
ON public.gestao_parts_orcamento_envios FOR UPDATE TO authenticated
USING (true);

CREATE TRIGGER set_gp_orcamento_envios_updated_at
BEFORE UPDATE ON public.gestao_parts_orcamento_envios
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_gp_orcamento_envios_status ON public.gestao_parts_orcamento_envios (status, created_at DESC);

-- 2) Configuração do envio automático (linha única)
CREATE TABLE public.gestao_parts_orcamento_config (
  id integer PRIMARY KEY DEFAULT 1,
  auto_send_enabled boolean NOT NULL DEFAULT false,
  activated_at timestamptz,
  dry_run boolean NOT NULL DEFAULT false,
  batch_size integer NOT NULL DEFAULT 20,
  message_template text,
  last_run_at timestamptz,
  last_run_summary jsonb,
  consecutive_failures integer NOT NULL DEFAULT 0,
  lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gestao_parts_orcamento_config_single_row CHECK (id = 1)
);

GRANT SELECT, INSERT, UPDATE ON public.gestao_parts_orcamento_config TO authenticated;
GRANT ALL ON public.gestao_parts_orcamento_config TO service_role;
ALTER TABLE public.gestao_parts_orcamento_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view orcamento config"
ON public.gestao_parts_orcamento_config FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can update orcamento config"
ON public.gestao_parts_orcamento_config FOR UPDATE TO authenticated
USING (true);

CREATE TRIGGER set_gp_orcamento_config_updated_at
BEFORE UPDATE ON public.gestao_parts_orcamento_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.gestao_parts_orcamento_config (id) VALUES (1);

-- 3) De-para vendedor do ERP -> usuário do sistema
CREATE TABLE public.gestao_parts_vendedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codvendedor text,
  nome text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_gp_vendedores_cod ON public.gestao_parts_vendedores (lower(coalesce(codvendedor, nome)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_parts_vendedores TO authenticated;
GRANT ALL ON public.gestao_parts_vendedores TO service_role;
ALTER TABLE public.gestao_parts_vendedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view vendedores"
ON public.gestao_parts_vendedores FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated can manage vendedores"
ON public.gestao_parts_vendedores FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE TRIGGER set_gp_vendedores_updated_at
BEFORE UPDATE ON public.gestao_parts_vendedores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Carteira por vendedor
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS wallet_only boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_conversations_assigned_to ON public.conversations (assigned_to);

CREATE OR REPLACE FUNCTION public.member_is_wallet_only(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.user_id = _user_id
      AND tm.status = 'active'
      AND tm.wallet_only = true
      AND tm.role <> 'admin'
      AND NOT EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = tm.organization_id AND o.owner_id = _user_id
      )
  )
$$;

-- Passa a considerar a carteira do vendedor além das restrições de canal
CREATE OR REPLACE FUNCTION public.can_access_conversation_channel(
  _user_id uuid,
  _conversation_user_id uuid,
  _instance_id uuid,
  _meta_phone_number_id text,
  _assigned_to uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- Carteira: vendedor restrito só enxerga o que está atribuído a ele
  IF public.member_is_wallet_only(_user_id) THEN
    RETURN _assigned_to IS NOT NULL AND _assigned_to = _user_id;
  END IF;

  RETURN true;
END;
$$;

-- Policies de conversations passam a enviar o responsável
DROP POLICY IF EXISTS "Users can view accessible conversations" ON public.conversations;
CREATE POLICY "Users can view accessible conversations"
ON public.conversations FOR SELECT TO authenticated
USING (
  public.can_access_conversation_channel((SELECT auth.uid()), user_id, instance_id, meta_phone_number_id, assigned_to)
  OR (
    (SELECT public.is_sdr((SELECT auth.uid())))
    AND (
      (instance_id IS NOT NULL AND instance_id IN (SELECT public.get_sdr_instance_ids((SELECT auth.uid()))))
      OR (meta_phone_number_id IS NOT NULL AND meta_phone_number_id IN (SELECT public.get_sdr_meta_phone_number_ids((SELECT auth.uid()))))
    )
  )
);

DROP POLICY IF EXISTS "Users can update accessible conversations" ON public.conversations;
CREATE POLICY "Users can update accessible conversations"
ON public.conversations FOR UPDATE TO authenticated
USING (
  public.can_access_conversation_channel((SELECT auth.uid()), user_id, instance_id, meta_phone_number_id, assigned_to)
  OR (
    (SELECT public.is_sdr((SELECT auth.uid())))
    AND (
      (instance_id IS NOT NULL AND instance_id IN (SELECT public.get_sdr_instance_ids((SELECT auth.uid()))))
      OR (meta_phone_number_id IS NOT NULL AND meta_phone_number_id IN (SELECT public.get_sdr_meta_phone_number_ids((SELECT auth.uid()))))
    )
  )
);

DROP POLICY IF EXISTS "Users can delete organization conversations" ON public.conversations;
CREATE POLICY "Users can delete organization conversations"
ON public.conversations FOR DELETE TO authenticated
USING (
  public.can_access_conversation_channel((SELECT auth.uid()), user_id, instance_id, meta_phone_number_id, assigned_to)
);

-- can_access_conversation continua funcionando e agora respeita a carteira
CREATE OR REPLACE FUNCTION public.can_access_conversation(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = _conversation_id
      AND public.can_access_conversation_channel(
        _user_id,
        c.user_id,
        c.instance_id,
        c.meta_phone_number_id,
        c.assigned_to
      )
  )
$$;