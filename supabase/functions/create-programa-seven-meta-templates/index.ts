// Cria templates Meta oficiais das mensagens do funil Programa Seven
// Etapas: Pré-venda, Dia do Pagamento, Renegociado, Atraso
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const META_API_URL = 'https://graph.facebook.com/v21.0';

// Templates a criar (todos UTILITY / pt_BR)
const PS_TEMPLATES = [
  {
    name: 'ps_pre_venda_reserva',
    stage: 'Pré-venda',
    body:
      '*INFORMAÇÕES SOBRE OS SEUS ÓCULOS*\n\n' +
      'Olá, {{1}}! Como você está? 😊 Aqui é do Programa Seven.\n\n' +
      'Vi que você realizou uma reserva de óculos com a gente e quero te passar as informações que ficaram definidas no seu atendimento:\n\n' +
      '- Valor da compra: {{2}}\n' +
      '- Valor da entrada: {{3}}\n' +
      '- Data de pagamento da entrada: {{4}}\n' +
      '- Forma de pagamento: {{5}}\n\n' +
      'Qualquer dúvida, estou por aqui.\n\n' +
      'Abraços,\nEquipe Seven 💜',
    example: ['Maria', 'R$ 890,00', 'R$ 200,00', '10/08/2026', 'PIX'],
    footer: 'www.programaseven.com.br',
  },
  {
    name: 'ps_dia_do_pagamento_lembrete',
    stage: 'Dia do Pagamento',
    body:
      'Oi, tudo bem? 😊\nAqui é do Programa Seven.\n\n' +
      'Passando pra te lembrar que o vencimento do pagamento do seu óculos está programado para o dia {{1}}.\n\n' +
      'Se preferir, você pode realizar o pagamento via Pix:\n' +
      'Chave Pix: 32685931000167\n' +
      'Nome: SEVEN OCULOS COMÉRCIO E SERVIÇOS LTDA\n\n' +
      '*Valor da Entrada: {{2}}*\n\n' +
      'Caso queira outra forma de pagamento ou precise de ajuda, é só me responder por aqui que a gente resolve juntos, combinado?\n\n' +
      'Estamos à disposição 🤝',
    example: ['10/08/2026', 'R$ 200,00'],
    footer: 'Programa Seven',
  },
  {
    name: 'ps_renegociado_nova_data',
    stage: 'Renegociado',
    body:
      'Combinado, {{1}}! Ficou definida uma nova data para o pagamento da entrada dos seus óculos. ' +
      'Contamos com você para mantermos sua reserva ativa até lá. ' +
      'Qualquer dúvida, estamos à disposição!',
    example: ['Maria'],
    footer: 'Programa Seven',
  },
  {
    name: 'ps_atraso_entrada',
    stage: 'Atraso',
    body:
      'Olá, {{1}}! Notamos que o pagamento da entrada dos seus óculos no Programa Seven ainda está em aberto. ' +
      'Para mantermos sua reserva e darmos continuidade à confecção, pedimos que regularize o quanto antes. ' +
      'Qualquer dúvida ou dificuldade, estamos à disposição para ajudar!',
    example: ['Maria'],
    footer: 'Programa Seven',
  },
];

const OWNER_USER_ID = 'b3e1967e-cd4c-4835-8b3c-df65740a4fb9';
const WABA_ID = '4370320239880831';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Buscar access token da integração Meta do dono do funil
    const { data: orgMemberIds } = await supabase.rpc('get_organization_member_ids', {
      _user_id: OWNER_USER_ID,
    });
    const memberIds: string[] = orgMemberIds ?? [OWNER_USER_ID];

    const { data: integration } = await supabase
      .from('integrations')
      .select('user_id, credentials')
      .in('user_id', memberIds)
      .eq('provider', 'meta_whatsapp')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    const accessToken = (integration?.credentials as any)?.access_token;
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Meta access_token não encontrado' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar templates existentes na WABA para evitar duplicatas
    const existingResp = await fetch(
      `${META_API_URL}/${WABA_ID}/message_templates?fields=name,status,language&limit=200`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const existingData = await existingResp.json();
    const existing = new Map<string, { status: string; id?: string }>();
    for (const t of existingData?.data ?? []) {
      if (t.language === 'pt_BR') existing.set(t.name, { status: t.status, id: t.id });
    }

    const results: Array<Record<string, unknown>> = [];

    for (const tpl of PS_TEMPLATES) {
      const prev = existing.get(tpl.name);
      const varCount = (tpl.body.match(/\{\{\d+\}\}/g) || []).length;
      const example = tpl.example.slice(0, varCount);

      if (prev && prev.status !== 'REJECTED') {
        // Já existe: apenas sincroniza para meta_templates local
        await supabase.from('meta_templates').upsert(
          {
            user_id: OWNER_USER_ID,
            waba_id: WABA_ID,
            meta_template_id: prev.id ?? null,
            name: tpl.name,
            language: 'pt_BR',
            category: 'UTILITY',
            status: prev.status.toLowerCase(),
            body_text: tpl.body,
            body_examples: example,
            footer_text: tpl.footer ?? null,
            header_type: 'NONE',
            buttons: [],
            submitted_at: new Date().toISOString(),
          },
          { onConflict: 'waba_id,name,language' },
        );
        results.push({ name: tpl.name, skipped: true, status: prev.status, synced: true });
        continue;
      }


      const components: any[] = [
        {
          type: 'BODY',
          text: tpl.body,
          example: { body_text: [example] },
        },
      ];
      if (tpl.footer) components.push({ type: 'FOOTER', text: tpl.footer });

      const payload = {
        name: tpl.name,
        category: 'UTILITY',
        language: 'pt_BR',
        components,
      };

      const resp = await fetch(`${META_API_URL}/${WABA_ID}/message_templates`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const json = await resp.json();

      if (!resp.ok) {
        results.push({ name: tpl.name, success: false, error: json?.error?.message ?? 'erro', payload });
        continue;
      }

      // Persistir em meta_templates
      await supabase.from('meta_templates').upsert(
        {
          user_id: OWNER_USER_ID,
          waba_id: WABA_ID,
          meta_template_id: json.id ?? null,
          name: tpl.name,
          language: 'pt_BR',
          category: 'UTILITY',
          status: (json.status ?? 'PENDING').toLowerCase(),
          body_text: tpl.body,
          body_examples: example,
          footer_text: tpl.footer ?? null,
          header_type: 'NONE',
          buttons: [],
          submitted_at: new Date().toISOString(),
        },
        { onConflict: 'waba_id,name,language' },
      );

      results.push({ name: tpl.name, success: true, status: json.status ?? 'PENDING', stage: tpl.stage });
    }

    return new Response(JSON.stringify({ success: true, waba_id: WABA_ID, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('create-programa-seven-meta-templates error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
