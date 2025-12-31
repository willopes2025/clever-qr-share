import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fetch available time slots from Calendly
const fetchCalendlyAvailableTimes = async (
  supabaseUrl: string,
  agentConfigId: string,
  startDate: string,
  endDate: string
): Promise<Array<{ start_time: string; status: string }> | null> => {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/calendly-integration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        action: 'get-available-times',
        agentConfigId,
        startDate,
        endDate,
      }),
    });
    
    if (!response.ok) {
      console.error('[TEST-AI-AGENT] Failed to fetch available times:', await response.text());
      return null;
    }
    
    const data = await response.json();
    if (!data.success) return null;
    
    return data.availableTimes || [];
  } catch (e) {
    console.error('[TEST-AI-AGENT] Failed to fetch Calendly available times:', e);
    return null;
  }
};

// Format slot to Brazilian Portuguese
const formatSlotBR = (isoTime: string): string => {
  const date = new Date(isoTime);
  const dia = date.toLocaleDateString('pt-BR', { 
    weekday: 'long',
    day: '2-digit', 
    month: '2-digit',
    timeZone: 'America/Sao_Paulo'
  });
  const hora = date.toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo'
  });
  return `${dia} às ${hora}`;
};

// Replace slot placeholders in text
const replaceSlotPlaceholders = (text: string, slot1: string, slot2: string): string => {
  if (!text) return text;
  return text
    .replace(/\{\{slot1\}\}/gi, slot1)
    .replace(/\{\{slot2\}\}/gi, slot2)
    .replace(/\{\{p_slot1\}\}/gi, slot1)
    .replace(/\{\{p_slot2\}\}/gi, slot2);
};

// Check if text contains slot placeholders
const hasSlotPlaceholders = (text: string): boolean => {
  if (!text) return false;
  return /\{\{(slot1|slot2|p_slot1|p_slot2)\}\}/i.test(text);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agentId, userMessage, conversationHistory = [] } = await req.json();

    if (!agentId) {
      return new Response(
        JSON.stringify({ error: "agentId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!userMessage) {
      return new Response(
        JSON.stringify({ error: "userMessage é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch agent configuration
    const { data: agent, error: agentError } = await supabase
      .from("ai_agent_configs")
      .select("*")
      .eq("id", agentId)
      .single();

    if (agentError || !agent) {
      console.error("[TEST-AI-AGENT] Error fetching agent:", agentError);
      return new Response(
        JSON.stringify({ error: "Agente não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch knowledge items
    const { data: knowledgeItems } = await supabase
      .from("ai_agent_knowledge_items")
      .select("title, content, processed_content, source_type")
      .eq("agent_config_id", agentId)
      .eq("status", "completed");

    // Check for Calendly integration
    const { data: calendarIntegration } = await supabase
      .from("calendar_integrations")
      .select("*")
      .eq("agent_config_id", agentId)
      .eq("is_active", true)
      .single();

    const hasCalendarIntegration = !!calendarIntegration;
    console.log(`[TEST-AI-AGENT] Calendar integration: ${hasCalendarIntegration ? 'enabled' : 'disabled'}`);

    // Debug info for response
    const calendlyDebug = {
      connected: hasCalendarIntegration,
      prefetched: false,
      slotsCount: 0,
      slot1: null as string | null,
      slot2: null as string | null,
    };

    // === PRE-FETCH CALENDLY SLOTS ===
    // Check if we need to pre-fetch slots (first message or agent uses slot placeholders)
    const isFirstMessage = conversationHistory.length === 0;
    const needsSlots = hasSlotPlaceholders(agent.greeting_message) || 
                       hasSlotPlaceholders(agent.behavior_rules) ||
                       hasSlotPlaceholders(agent.personality_prompt);
    
    let slot1Formatted = '';
    let slot2Formatted = '';
    let prefetchedSlots: Array<{ start_time: string; status: string }> = [];

    if (hasCalendarIntegration && (isFirstMessage || needsSlots)) {
      console.log('[TEST-AI-AGENT] Pre-fetching Calendly slots...');
      
      // Fetch next 6 days (safety margin - Calendly API limits to 7 days max)
      const today = new Date();
      const startDate = today.toISOString().split('T')[0];
      const endDate = new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      console.log(`[TEST-AI-AGENT] Fetching Calendly slots from ${startDate} to ${endDate}`);
      
      const availableTimes = await fetchCalendlyAvailableTimes(supabaseUrl, agentId, startDate, endDate);
      
      if (availableTimes && availableTimes.length > 0) {
        prefetchedSlots = availableTimes;
        calendlyDebug.prefetched = true;
        calendlyDebug.slotsCount = availableTimes.length;
        
        // Get first two slots
        if (availableTimes[0]) {
          slot1Formatted = formatSlotBR(availableTimes[0].start_time);
          calendlyDebug.slot1 = slot1Formatted;
        }
        if (availableTimes[1]) {
          slot2Formatted = formatSlotBR(availableTimes[1].start_time);
          calendlyDebug.slot2 = slot2Formatted;
        }
        
        console.log(`[TEST-AI-AGENT] Pre-fetched ${availableTimes.length} slots. slot1: ${slot1Formatted}, slot2: ${slot2Formatted}`);
      } else {
        console.log('[TEST-AI-AGENT] No slots available from Calendly');
        slot1Formatted = 'sem horários disponíveis no momento';
        slot2Formatted = 'sem horários disponíveis no momento';
      }
    }

    // === REPLACE PLACEHOLDERS IN AGENT CONFIG ===
    const greetingMessage = replaceSlotPlaceholders(agent.greeting_message || '', slot1Formatted, slot2Formatted);
    const behaviorRules = replaceSlotPlaceholders(agent.behavior_rules || '', slot1Formatted, slot2Formatted);
    const personalityPrompt = replaceSlotPlaceholders(agent.personality_prompt || '', slot1Formatted, slot2Formatted);

    // Build knowledge base text
    let knowledgeText = "";
    if (knowledgeItems && knowledgeItems.length > 0) {
      knowledgeText = "\n\nBASE DE CONHECIMENTO:\n";
      knowledgeItems.forEach((item) => {
        const content = item.processed_content || item.content;
        if (content) {
          knowledgeText += `\n--- ${item.title} (${item.source_type}) ---\n${content}\n`;
        }
      });
    }

    // Get current date/time for context
    const agora = new Date();
    const dataAtualFormatada = agora.toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      timeZone: 'America/Sao_Paulo'
    });
    const horaAtual = agora.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo'
    });
    const anoAtual = agora.getFullYear();

    // Build calendar context with pre-fetched slots
    let calendarContext = '';
    if (hasCalendarIntegration) {
      let slotsInfo = '';
      if (prefetchedSlots.length > 0) {
        const slotsFormatted = prefetchedSlots.slice(0, 6).map((slot, i) => {
          return `  ${i + 1}. ${formatSlotBR(slot.start_time)}`;
        }).join('\n');
        slotsInfo = `
HORÁRIOS DISPONÍVEIS (JÁ CONSULTADOS DO CALENDLY):
${slotsFormatted}

📌 SLOT1 = ${slot1Formatted}
📌 SLOT2 = ${slot2Formatted}`;
      } else {
        slotsInfo = '\n⚠️ Não há horários disponíveis nos próximos 7 dias.';
      }

      calendarContext = `
## 🗓️ CALENDLY CONECTADO
${slotsInfo}

### 🚨 REGRAS OBRIGATÓRIAS DE AGENDAMENTO 🚨
1. Use SOMENTE os horários listados acima
2. NUNCA invente datas ou horários
3. Se o cliente perguntar "quando" ou "horário", ofereça slot1 e slot2
4. Se os horários acima não servirem, diga que vai verificar outras opções`;
    }

    // Build system prompt with REPLACED content
    const systemPrompt = `## DATA E HORA ATUAIS (OBRIGATÓRIO)
- Hoje é ${dataAtualFormatada}
- Agora são ${horaAtual} (horário de Brasília)
- O ano atual é ${anoAtual}

Você é ${agent.agent_name}, um assistente virtual.

PERSONALIDADE:
${personalityPrompt || "Seja profissional e prestativo."}

REGRAS DE COMPORTAMENTO:
${behaviorRules || "Responda de forma clara e objetiva."}

MENSAGEM DE SAUDAÇÃO (use como referência de tom):
${greetingMessage || ""}

MENSAGEM DE DESPEDIDA:
${agent.goodbye_message || ""}

MENSAGEM DE FALLBACK:
${agent.fallback_message || "Desculpe, não entendi. Pode reformular?"}
${knowledgeText}
${calendarContext}

INSTRUÇÕES FINAIS:
- Este é um TESTE de simulação. Responda como se estivesse em uma conversa real via WhatsApp.
- Mantenha respostas curtas e naturais (2-3 linhas).
- Use a personalidade e regras definidas acima.
- Use a base de conhecimento para responder perguntas específicas.
${hasCalendarIntegration ? `- CRÍTICO: Para horários, use APENAS slot1 (${slot1Formatted}) e slot2 (${slot2Formatted}). NÃO INVENTE DATAS.` : ''}`;

    // Build messages array for API
    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.map((msg: { role: string; content: string }) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: "user", content: userMessage },
    ];

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[TEST-AI-AGENT] Calling AI. First message: ${isFirstMessage}, Has calendar: ${hasCalendarIntegration}`);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[TEST-AI-AGENT] AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione mais créditos." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Erro ao chamar IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    let response = aiData.choices?.[0]?.message?.content || '';

    // === GUARDRAIL: Validate response has correct slots ===
    if (hasCalendarIntegration && prefetchedSlots.length > 0 && response) {
      // Check if response mentions dates/times but not our slots
      const mentionsDates = /\d{1,2}\/\d{1,2}|\d{1,2}h|\d{1,2}:\d{2}/.test(response);
      const hasCorrectSlot = slot1Formatted && response.includes(slot1Formatted.split(' às ')[1] || '');
      
      if (mentionsDates && !hasCorrectSlot) {
        console.log('[TEST-AI-AGENT] Guardrail triggered - response has wrong dates, fixing...');
        
        // Make a correction call
        const correctionMessages = [
          ...messages,
          { role: "assistant", content: response },
          { 
            role: "user", 
            content: `CORREÇÃO OBRIGATÓRIA: Sua resposta contém horários incorretos. Reescreva usando EXATAMENTE estes horários: ${slot1Formatted} ou ${slot2Formatted}. Mantenha o mesmo tom e estrutura, apenas corrija os horários.`
          }
        ];

        const correctionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: correctionMessages,
          }),
        });

        if (correctionResponse.ok) {
          const correctionData = await correctionResponse.json();
          const correctedResponse = correctionData.choices?.[0]?.message?.content;
          if (correctedResponse) {
            console.log('[TEST-AI-AGENT] Guardrail applied, using corrected response');
            response = correctedResponse;
          }
        }
      }
    }

    if (!response) {
      return new Response(
        JSON.stringify({ error: "Resposta vazia da IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        response,
        agentName: agent.agent_name,
        hasCalendarIntegration,
        calendlyDebug,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[TEST-AI-AGENT] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
