import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const LOVABLE_AI_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const { funnelIds, userId, dryRun = false } = await req.json();
    if (!Array.isArray(funnelIds) || !userId) {
      return new Response(JSON.stringify({ error: 'funnelIds[] and userId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find unanswered conversations (last message inbound) for contacts that have a deal in these funnels
    const { data: convs, error: convErr } = await supabase
      .from('conversations')
      .select(`
        id, user_id, instance_id, meta_phone_number_id, provider, contact_id,
        contact:contacts(id, name, phone),
        funnel_deals!inner(funnel_id, funnels(name))
      `)
      .eq('user_id', userId)
      .eq('status', 'open')
      .eq('last_message_direction', 'inbound')
      .in('funnel_deals.funnel_id', funnelIds);

    if (convErr) throw convErr;

    // Dedup
    const uniqConvs = new Map<string, any>();
    for (const c of (convs || [])) if (!uniqConvs.has(c.id)) uniqConvs.set(c.id, c);

    // Fetch agent configs per funnel
    const { data: agents } = await supabase
      .from('ai_agent_configs')
      .select('*')
      .in('funnel_id', funnelIds)
      .eq('is_active', true);

    const agentByFunnel = new Map<string, any>();
    for (const a of (agents || [])) agentByFunnel.set(a.funnel_id, a);

    const results: any[] = [];

    for (const conv of uniqConvs.values()) {
      const funnelId = conv.funnel_deals?.[0]?.funnel_id;
      const funnelName = conv.funnel_deals?.[0]?.funnels?.name;
      const agent = agentByFunnel.get(funnelId);
      const contact = conv.contact;

      if (!agent) {
        results.push({ conversationId: conv.id, skipped: 'no_active_agent', funnelName });
        continue;
      }
      if (!contact?.phone) {
        results.push({ conversationId: conv.id, skipped: 'no_phone' });
        continue;
      }

      // Fetch last ~15 messages for context
      const { data: msgs } = await supabase
        .from('inbox_messages')
        .select('direction, content, created_at, message_type')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(15);

      const history = (msgs || []).reverse().map((m: any) => ({
        role: m.direction === 'inbound' ? 'user' : 'assistant',
        content: m.content || `[${m.message_type}]`,
      }));

      const lastInbound = (msgs || []).find((m: any) => m.direction === 'inbound');
      if (!lastInbound) {
        results.push({ conversationId: conv.id, skipped: 'no_inbound_message' });
        continue;
      }

      const systemPrompt = `${agent.personality_prompt || 'Você é um atendente profissional.'}

${agent.behavior_rules ? `REGRAS DE COMPORTAMENTO:\n${agent.behavior_rules}\n` : ''}
Você está retomando uma conversa de WhatsApp que ficou sem resposta. O cliente se chama ${contact.name || 'Cliente'}.
Responda de forma natural, acolhedora e direta à última mensagem do cliente. Retorne APENAS o texto da mensagem, sem aspas, sem cabeçalho.`;

      try {
        const aiResp = await fetch(LOVABLE_AI_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'openai/gpt-5.4-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              ...history,
            ],
          }),
        });

        if (!aiResp.ok) {
          const errText = await aiResp.text();
          results.push({ conversationId: conv.id, error: `ai_${aiResp.status}`, detail: errText.slice(0, 200) });
          continue;
        }
        const aiData = await aiResp.json();
        const generated = aiData.choices?.[0]?.message?.content?.trim();
        if (!generated) {
          results.push({ conversationId: conv.id, error: 'empty_ai_response' });
          continue;
        }

        if (dryRun) {
          results.push({ conversationId: conv.id, funnelName, contact: contact.name, preview: generated.slice(0, 200), dryRun: true });
          continue;
        }

        // Activate AI flag on conversation
        await supabase.from('conversations').update({
          ai_handled: true,
          ai_paused: false,
          ai_handoff_requested: false,
          ai_handoff_reason: null,
        }).eq('id', conv.id);

        // Send via send-inbox-message (handles both Meta + Evolution)
        const sendResp = await fetch(`${SUPABASE_URL}/functions/v1/send-inbox-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify({
            conversationId: conv.id,
            content: generated,
            messageType: 'text',
          }),
        });

        const sendData = await sendResp.json().catch(() => ({}));
        if (!sendResp.ok) {
          results.push({ conversationId: conv.id, error: 'send_failed', status: sendResp.status, detail: sendData });
          continue;
        }

        // Mark as AI-generated
        if (sendData?.messageId) {
          await supabase.from('inbox_messages')
            .update({ is_ai_generated: true, sent_by_ai_agent_id: agent.id })
            .eq('id', sendData.messageId);
        }

        results.push({ conversationId: conv.id, funnelName, contact: contact.name, sent: true, preview: generated.slice(0, 120) });
      } catch (e) {
        results.push({ conversationId: conv.id, error: 'exception', detail: e instanceof Error ? e.message : String(e) });
      }
    }

    const summary = {
      total: uniqConvs.size,
      sent: results.filter(r => r.sent).length,
      skipped: results.filter(r => r.skipped).length,
      errors: results.filter(r => r.error).length,
      dryRun,
    };

    return new Response(JSON.stringify({ summary, results }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
