-- 1) Campos de rastreio no snapshot do ERP
ALTER TABLE public.gestao_parts_lead_data
  ADD COLUMN IF NOT EXISTS chave_processo text,
  ADD COLUMN IF NOT EXISTS ultimo_status text,
  ADD COLUMN IF NOT EXISTS ultimo_status_em timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_gp_lead_data_chave_processo
  ON public.gestao_parts_lead_data (chave_processo);

-- 2) Funil de status de pedidos condicionais
DO $$
DECLARE
  v_owner uuid := '7965cb1b-d58d-4a60-a8bb-ea5c92e3c5f4';
  v_funnel uuid;
  v_stage uuid;
  r record;
BEGIN
  SELECT id INTO v_funnel FROM public.funnels
   WHERE user_id = v_owner AND name = 'Pedidos Condicionais' LIMIT 1;

  IF v_funnel IS NULL THEN
    INSERT INTO public.funnels (user_id, name, description, color, display_order)
    VALUES (v_owner, 'Pedidos Condicionais',
            'Status automático dos pedidos condicionais do ERP Gestão Parts', '#F59E0B', 99)
    RETURNING id INTO v_funnel;
  END IF;

  FOR r IN
    SELECT * FROM (VALUES
      (0,  'Aguardando separação',            '#94A3B8', NULL::text),
      (1,  'Em separação',                    '#3B82F6', 'Oi {{nome}}! Seu pedido {{pedido}} já está em separação aqui no estoque. 📦'),
      (2,  'Separação concluída',             '#6366F1', '{{nome}}, a separação do seu pedido {{pedido}} foi concluída e ele seguiu para conferência.'),
      (3,  'Aguardando conferência',          '#94A3B8', NULL),
      (4,  'Em conferência',                  '#8B5CF6', 'Seu pedido {{pedido}} está passando pela conferência de qualidade agora.'),
      (5,  'Conferência finalizada',          '#A855F7', NULL),
      (6,  'Em faturamento',                  '#F59E0B', 'Estamos emitindo a nota fiscal do seu pedido {{pedido}}.'),
      (7,  'Faturado',                        '#10B981', 'Pedido {{pedido}} faturado! Nota fiscal emitida — em breve segue para entrega. ✅'),
      (8,  'Aguardando liberação de entrega', '#94A3B8', NULL),
      (9,  'Liberado para entrega',           '#14B8A6', 'Boa notícia, {{nome}}: seu pedido {{pedido}} foi liberado para entrega.'),
      (10, 'Enviado ao transportador',        '#0EA5E9', 'Seu pedido {{pedido}} saiu para entrega com o transportador. 🚚'),
      (11, 'Entrega concluída',               '#22C55E', 'Entrega concluída! Esperamos que esteja tudo certo com o pedido {{pedido}}. Qualquer coisa, é só chamar aqui. 🙌')
    ) AS t(ord, nome, cor, msg)
  LOOP
    SELECT id INTO v_stage FROM public.funnel_stages
     WHERE funnel_id = v_funnel AND name = r.nome LIMIT 1;

    IF v_stage IS NULL THEN
      INSERT INTO public.funnel_stages (funnel_id, name, color, display_order, is_final, final_type)
      VALUES (v_funnel, r.nome, r.cor, r.ord, r.ord = 11, CASE WHEN r.ord = 11 THEN 'won' ELSE NULL END)
      RETURNING id INTO v_stage;
    ELSE
      UPDATE public.funnel_stages SET display_order = r.ord, color = r.cor WHERE id = v_stage;
    END IF;

    IF r.msg IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.funnel_automations
       WHERE funnel_id = v_funnel AND stage_id = v_stage AND trigger_type = 'on_stage_enter'
    ) THEN
      INSERT INTO public.funnel_automations
        (user_id, funnel_id, stage_id, name, trigger_type, trigger_config, action_type, action_config, is_active)
      VALUES (v_owner, v_funnel, v_stage, 'Status: ' || r.nome, 'on_stage_enter', '{}'::jsonb,
              'send_message',
              jsonb_build_object('message', r.msg, 'instance_id', 'auto'),
              true);
    END IF;
  END LOOP;
END $$;