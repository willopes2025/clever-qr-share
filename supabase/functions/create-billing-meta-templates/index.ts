import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const META_API_URL = 'https://graph.facebook.com/v19.0';

const BILLING_TEMPLATES = [
  {
    name: 'cobranca_emitida',
    body: 'Olá {{1}}! Sua cobrança no valor de R${{2}} foi gerada com sucesso. O vencimento é {{3}}. Acesse o link a seguir para realizar o pagamento: {{4}} - Qualquer dúvida, estamos à disposição.',
    example: ['João', '150,00', '10/07/2025', 'https://www.asaas.com/i/abc123'],
  },
  {
    name: 'cobranca_5dias_antes',
    body: 'Olá! Estamos lembrando que sua cobrança no valor de R${{1}} vence em 5 dias, no dia {{2}}. Acesse o link a seguir para realizar o pagamento: {{3}} - Evite juros e multas pagando em dia.',
    example: ['150,00', '10/07/2025', 'https://www.asaas.com/i/abc123'],
  },
  {
    name: 'cobranca_dia_vencimento',
    body: 'Olá! Hoje é o dia do vencimento da sua cobrança no valor de R${{1}}. Evite juros realizando o pagamento agora pelo link: {{2}} - Agradecemos a sua atenção.',
    example: ['150,00', 'https://www.asaas.com/i/abc123'],
  },
  {
    name: 'cobranca_1dia_atraso',
    body: 'Olá! Informamos que sua cobrança no valor de R${{1}}, com vencimento em {{2}}, encontra-se em atraso. Regularize sua situação acessando o link: {{3}} - Evite encargos adicionais.',
    example: ['150,00', '10/07/2025', 'https://www.asaas.com/i/abc123'],
  },
  {
    name: 'cobranca_3dias_atraso',
    body: 'Olá! Sua cobrança no valor de R${{1}} está em atraso há 3 dias. O vencimento foi em {{2}}. Acesse o link a seguir para regularizar: {{3}} - Entre em contato se precisar de ajuda.',
    example: ['150,00', '10/07/2025', 'https://www.asaas.com/i/abc123'],
  },
  {
    name: 'cobranca_5dias_atraso',
    body: 'Olá! Este é o último lembrete: sua cobrança no valor de R${{1}} está em atraso desde {{2}}. Regularize agora pelo link: {{3}} - Entre em contato conosco para negociar.',
    example: ['150,00', '10/07/2025', 'https://www.asaas.com/i/abc123'],
  },
];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { action, wabaId } = body;

    // Get Meta integration for access token
    const { data: integration } = await supabase
      .from('integrations')
      .select('credentials')
      .eq('user_id', user.id)
      .eq('provider', 'meta_whatsapp')
      .eq('is_active', true)
      .maybeSingle();

    if (!integration) {
      // Try org fallback
      const { data: orgMemberIds } = await supabase.rpc('get_organization_member_ids', { _user_id: user.id });
      if (orgMemberIds && orgMemberIds.length > 0) {
        const { data: orgIntegration } = await supabase
          .from('integrations')
          .select('credentials')
          .in('user_id', orgMemberIds)
          .eq('provider', 'meta_whatsapp')
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        if (!orgIntegration) {
          return new Response(JSON.stringify({ error: 'Integração Meta não encontrada' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        var accessToken = (orgIntegration.credentials as any)?.access_token;
      } else {
        return new Response(JSON.stringify({ error: 'Integração Meta não encontrada' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else {
      var accessToken = (integration.credentials as any)?.access_token;
    }

    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Access token não configurado' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!wabaId) {
      return new Response(JSON.stringify({ error: 'WABA ID é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Action: check_status - just fetch existing templates status
    if (action === 'check_status') {
      const response = await fetch(
        `${META_API_URL}/${wabaId}/message_templates?fields=name,status,language&limit=100`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      const result = await response.json();
      if (!response.ok) {
        return new Response(JSON.stringify({ error: result.error?.message || 'Erro ao buscar templates' }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const billingTemplateNames = BILLING_TEMPLATES.map(t => t.name);
      const statuses: Record<string, string> = {};
      
      for (const tmpl of (result.data || [])) {
        if (billingTemplateNames.includes(tmpl.name) && tmpl.language === 'pt_BR') {
          statuses[tmpl.name] = tmpl.status;
        }
      }

      return new Response(JSON.stringify({ success: true, statuses }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Action: create - submit templates for approval
    if (action === 'create') {
      const results: Record<string, { success: boolean; status?: string; error?: string }> = {};

      // First check which already exist
      const checkResponse = await fetch(
        `${META_API_URL}/${wabaId}/message_templates?fields=name,status,language&limit=100`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      const existingData = await checkResponse.json();
      const existingTemplates = new Map<string, string>();
      
      for (const tmpl of (existingData.data || [])) {
        if (tmpl.language === 'pt_BR') {
          existingTemplates.set(tmpl.name, tmpl.status);
        }
      }

      for (const template of BILLING_TEMPLATES) {
        // Skip if already exists and not rejected
        const existingStatus = existingTemplates.get(template.name);
        if (existingStatus && existingStatus !== 'REJECTED') {
          results[template.name] = { success: true, status: existingStatus };
          console.log(`Template ${template.name} already exists with status: ${existingStatus}`);
          continue;
        }

        // Count variable placeholders
        const varCount = (template.body.match(/\{\{\d+\}\}/g) || []).length;
        const exampleParams = template.example.slice(0, varCount);

        const payload = {
          name: template.name,
          category: 'UTILITY',
          language: 'pt_BR',
          components: [
            {
              type: 'BODY',
              text: template.body,
              example: {
                body_text: [exampleParams],
              },
            },
          ],
        };

        console.log(`Creating template ${template.name}:`, JSON.stringify(payload));

        const response = await fetch(`${META_API_URL}/${wabaId}/message_templates`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (response.ok) {
          results[template.name] = { success: true, status: result.status || 'PENDING' };
          console.log(`Template ${template.name} created: ${result.status}`);
        } else {
          results[template.name] = { success: false, error: result.error?.message || 'Unknown error' };
          console.error(`Template ${template.name} error:`, result.error);
        }
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Ação inválida. Use "create" ou "check_status"' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
