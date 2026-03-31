import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const {
      funnel_id,
      deal_ids,
      prompt,
      campaign_config,
      instance_ids,
      sending_mode = 'sequential',
    } = await req.json();

    if (!funnel_id || !deal_ids?.length || !prompt) {
      throw new Error('funnel_id, deal_ids and prompt are required');
    }

    if (!instance_ids?.length) {
      throw new Error('At least one instance is required');
    }

    console.log(`Generating AI messages for ${deal_ids.length} deals in funnel ${funnel_id}`);

    // 1. Fetch deals with contact info, opportunity data, and conversation history
    const dealContexts = await Promise.all(deal_ids.map(async (dealId: string) => {
      // Get deal info
      const { data: deal } = await supabase
        .from('funnel_deals')
        .select('id, contact_id, stage_id, value, created_at, funnel_stages(name)')
        .eq('id', dealId)
        .single();

      if (!deal?.contact_id) return null;

      // Get contact info
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, name, phone, email')
        .eq('id', deal.contact_id)
        .single();

      if (!contact) return null;

      // Get opportunity analysis
      const { data: opportunity } = await supabase
        .from('funnel_opportunities')
        .select('score, insight, status, user_notes')
        .eq('funnel_id', funnel_id)
        .eq('deal_id', dealId)
        .single();

      // Get last 20 messages from conversation
      const { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', deal.contact_id)
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .single();

      let recentMessages: any[] = [];
      if (conversation) {
        const { data: msgs } = await supabase
          .from('inbox_messages')
          .select('content, direction, created_at')
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: false })
          .limit(20);
        recentMessages = (msgs || []).reverse();
      }

      const stageName = (deal as any).funnel_stages?.name || 'Desconhecida';

      return {
        dealId,
        contactId: contact.id,
        contactName: contact.name || 'Sem nome',
        contactPhone: contact.phone,
        stageName,
        dealValue: deal.value,
        score: opportunity?.score || 0,
        insight: opportunity?.insight || '',
        userNotes: opportunity?.user_notes || '',
        status: opportunity?.status || 'open',
        recentMessages,
      };
    }));

    const validContexts = dealContexts.filter(Boolean);

    if (!validContexts.length) {
      throw new Error('Nenhum deal válido encontrado');
    }

    // 2. Generate AI messages using tool calling for structured output
    const systemPrompt = `Você é um especialista em vendas e comunicação via WhatsApp. 
Sua tarefa é gerar mensagens personalizadas para cada lead/contato baseado nos dados fornecidos.

Regras importantes:
- Mensagens curtas e naturais (máximo 3 parágrafos)
- Tom conversacional e profissional
- Use o nome do contato quando disponível
- Considere o histórico de conversa para continuidade
- Considere o score e insight da análise de oportunidades
- Considere anotações do vendedor (user_notes) se houver
- Não use emojis em excesso
- Não inclua links genéricos
- Cada mensagem deve ser ÚNICA e personalizada para aquele contato específico`;

    const contactsData = validContexts.map((ctx: any) => ({
      contactName: ctx.contactName,
      stageName: ctx.stageName,
      dealValue: ctx.dealValue,
      score: ctx.score,
      insight: ctx.insight,
      userNotes: ctx.userNotes,
      recentMessages: ctx.recentMessages.map((m: any) => ({
        direction: m.direction,
        content: (m.content || '').substring(0, 200),
      })),
    }));

    const userPrompt = `Instruções do vendedor: "${prompt}"

Gere uma mensagem personalizada para cada um dos ${validContexts.length} contatos abaixo.
Use a ferramenta generate_messages para retornar as mensagens.

Contatos:
${contactsData.map((c: any, i: number) => `
--- Contato ${i + 1}: ${c.contactName} ---
Etapa: ${c.stageName}
Valor: R$ ${c.dealValue || 0}
Score: ${c.score}/100
Insight IA: ${c.insight}
Notas do vendedor: ${c.userNotes || 'Nenhuma'}
Últimas mensagens: ${c.recentMessages.length > 0 ? c.recentMessages.map((m: any) => `[${m.direction}] ${m.content}`).join('\n') : 'Sem histórico'}
`).join('\n')}`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-nano',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'generate_messages',
            description: 'Generate personalized messages for each contact',
            parameters: {
              type: 'object',
              properties: {
                messages: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      contact_index: { type: 'number', description: 'Index of the contact (0-based)' },
                      message: { type: 'string', description: 'Personalized WhatsApp message' },
                    },
                    required: ['contact_index', 'message'],
                  },
                },
              },
              required: ['messages'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'generate_messages' } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições IA excedido. Tente novamente em alguns segundos.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos de IA esgotados. Adicione créditos na sua conta.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errText);
      throw new Error('Erro ao gerar mensagens com IA');
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error('IA não retornou mensagens estruturadas');
    }

    const generated = JSON.parse(toolCall.function.arguments);
    const generatedMessages: { contact_index: number; message: string }[] = generated.messages || [];

    console.log(`AI generated ${generatedMessages.length} messages`);

    // 3. Create broadcast list
    const { data: list, error: listError } = await supabase
      .from('broadcast_lists')
      .insert({
        user_id: user.id,
        name: `IA Oportunidades - ${new Date().toLocaleString('pt-BR')}`,
        description: `Lista gerada por IA com ${validContexts.length} contatos personalizados`,
        type: 'manual',
      })
      .select()
      .single();

    if (listError) throw listError;

    // 4. Add contacts to list (deduplicate by contactId)
    const seenContactIds = new Set<string>();
    const contactEntries = validContexts
      .filter((ctx: any) => {
        if (seenContactIds.has(ctx.contactId)) return false;
        seenContactIds.add(ctx.contactId);
        return true;
      })
      .map((ctx: any) => ({
        list_id: list.id,
        contact_id: ctx.contactId,
      }));

    const { error: contactsError } = await supabase
      .from('broadcast_list_contacts')
      .upsert(contactEntries, { onConflict: 'list_id,contact_id', ignoreDuplicates: true });

    if (contactsError) throw contactsError;

    // 5. Create campaign
    const config = campaign_config || {};
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        user_id: user.id,
        name: `Disparo IA - Oportunidades`,
        list_id: list.id,
        status: 'sending',
        total_contacts: validContexts.length,
        instance_ids,
        sending_mode,
        started_at: new Date().toISOString(),
        message_interval_min: config.message_interval_min ?? 90,
        message_interval_max: config.message_interval_max ?? 180,
        daily_limit: config.daily_limit ?? 1000,
        allowed_start_hour: config.allowed_start_hour ?? 8,
        allowed_end_hour: config.allowed_end_hour ?? 20,
        allowed_days: config.allowed_days ?? ['mon', 'tue', 'wed', 'thu', 'fri'],
        timezone: config.timezone ?? 'America/Sao_Paulo',
        skip_already_sent: config.skip_already_sent ?? false,
        skip_mode: config.skip_mode ?? 'same_template',
        skip_days_period: config.skip_days_period ?? 30,
        skip_tag_id: config.skip_tag_id ?? null,
        tag_on_delivery_id: config.tag_on_delivery_id ?? null,
        ai_enabled: config.ai_enabled ?? false,
      })
      .select()
      .single();

    if (campaignError) throw campaignError;

    // 6. Link AI agent if configured
    if (config.ai_enabled && config.agent_id) {
      await supabase
        .from('ai_agent_configs')
        .update({ campaign_id: campaign.id })
        .eq('id', config.agent_id);
    }

    // 7. Insert campaign_messages with AI-generated content
    const messageRecords = validContexts.map((ctx: any, index: number) => {
      const aiMsg = generatedMessages.find((m) => m.contact_index === index);
      const content = aiMsg?.message || `Olá ${ctx.contactName}!`;

      return {
        campaign_id: campaign.id,
        contact_id: ctx.contactId,
        contact_name: ctx.contactName,
        phone: ctx.contactPhone,
        message_content: content,
        status: 'queued',
      };
    });

    const { error: msgsError } = await supabase
      .from('campaign_messages')
      .insert(messageRecords);

    if (msgsError) throw msgsError;

    console.log(`Inserted ${messageRecords.length} AI-generated campaign messages`);

    // 8. Fetch instance details and trigger send-campaign-messages
    const { data: instancesData } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_name, warming_level')
      .in('id', instance_ids);

    const instancesList = (instancesData || []).map((inst: any) => ({
      id: inst.id,
      instance_name: inst.instance_name,
      warming_level: inst.warming_level || 1,
    }));

    const sendUrl = `${supabaseUrl}/functions/v1/send-campaign-messages`;

    EdgeRuntime.waitUntil(
      fetch(sendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          campaignId: campaign.id,
          instances: instancesList,
          sendingMode: sending_mode,
        }),
      }).catch((err) => console.error('Failed to invoke send-campaign-messages:', err))
    );

    return new Response(JSON.stringify({
      success: true,
      campaign_id: campaign.id,
      messages_generated: messageRecords.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-opportunity-messages:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
