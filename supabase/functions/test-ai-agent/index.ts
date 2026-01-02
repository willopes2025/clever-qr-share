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

// Create a booking via Calendly
const createCalendlyBooking = async (
  supabaseUrl: string,
  agentConfigId: string,
  startTime: string,
  inviteeName: string,
  inviteeEmail: string,
  inviteePhone?: string
): Promise<{ success: boolean; booking?: Record<string, unknown>; error?: string }> => {
  try {
    console.log(`[TEST-AI-AGENT] Creating booking: ${startTime} for ${inviteeName} <${inviteeEmail}>`);
    
    const response = await fetch(`${supabaseUrl}/functions/v1/calendly-integration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        action: 'create-booking',
        agentConfigId,
        startTime,
        inviteeName,
        inviteeEmail,
        inviteePhone,
        timezone: 'America/Sao_Paulo',
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      console.error('[TEST-AI-AGENT] Failed to create booking:', data.error);
      return { success: false, error: data.error || 'Erro ao criar agendamento' };
    }
    
    console.log('[TEST-AI-AGENT] Booking created successfully:', data.booking?.uri);
    return { success: true, booking: data.booking };
  } catch (e) {
    console.error('[TEST-AI-AGENT] Failed to create Calendly booking:', e);
    return { success: false, error: 'Erro de conexão ao criar agendamento' };
  }
};

// Define Calendly tools for AI
const getCalendlyTools = () => [
  {
    type: 'function',
    function: {
      name: 'get_available_times',
      description: 'Busca horários disponíveis para agendamento no Calendly. Use SEMPRE que o cliente pedir horários de outro dia, outra semana, ou um dia específico (terça, quarta, etc.).',
      parameters: {
        type: 'object',
        properties: {
          start_date: { 
            type: 'string', 
            description: 'Data de início para buscar horários (formato YYYY-MM-DD). Use a data de hoje ou a data mencionada pelo cliente.' 
          },
          end_date: { 
            type: 'string', 
            description: 'Data de fim para buscar horários (formato YYYY-MM-DD). Máximo 6 dias após start_date.' 
          },
        },
        required: ['start_date', 'end_date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_booking',
      description: 'Cria um agendamento confirmado no Calendly. Use APENAS quando o cliente confirmar um horário específico E você tiver coletado nome (obrigatório) e opcionalmente email. O start_time DEVE ser EXATAMENTE o valor ISO retornado por get_available_times.',
      parameters: {
        type: 'object',
        properties: {
          start_time: { 
            type: 'string', 
            description: 'OBRIGATÓRIO: Use EXATAMENTE o valor ISO retornado por get_available_times (ex: 2025-12-29T12:00:00.000000Z). NUNCA modifique este valor.' 
          },
          invitee_name: { 
            type: 'string', 
            description: 'Nome completo do cliente (OBRIGATÓRIO)' 
          },
          invitee_email: { 
            type: 'string', 
            description: 'Email do cliente (OPCIONAL - se não tiver, o sistema gera automaticamente)' 
          },
          invitee_phone: { 
            type: 'string', 
            description: 'Telefone do cliente (use para gerar email se não tiver email)' 
          },
        },
        required: ['start_time', 'invitee_name'],
      },
    },
  },
];

// Detect conversation state from history
interface ConversationState {
  horarioJaEscolhido: boolean;
  horarioAmbiguo: boolean; // User gave generic response ("pode ser") when multiple times were offered
  oticaIndicadaJaPerguntou: boolean;
  nomeJaColetou: boolean;
  emailJaColetou: boolean;
  saudacaoJaFeita: boolean;
  ultimaPerguntaAgente: string | null;
  horarioEscolhido: string | null;
  horariosOferecidos: string | null; // The times that were offered by agent
}

const detectConversationState = (conversationHistory: Array<{ role: string; content: string }>, currentUserMessage?: string): ConversationState => {
  const state: ConversationState = {
    horarioJaEscolhido: false,
    horarioAmbiguo: false,
    oticaIndicadaJaPerguntou: false,
    nomeJaColetou: false,
    emailJaColetou: false,
    saudacaoJaFeita: conversationHistory.length > 0,
    ultimaPerguntaAgente: null,
    horarioEscolhido: null,
    horariosOferecidos: null,
  };

  const assistantMessages = conversationHistory.filter(m => m.role === 'assistant');
  const userMessages = conversationHistory.filter(m => m.role === 'user');

  for (const msg of assistantMessages) {
    const content = msg.content.toLowerCase();
    
    // Detect if greeting was done
    if (/ol[aá]|bom dia|boa tarde|boa noite|bem-vindo/i.test(content)) {
      state.saudacaoJaFeita = true;
    }
    
    // Detect if asked about optical/referral
    if (/[oó]tica indicada|indicada\?|indica[çc][aã]o|vindo por alguma/i.test(content)) {
      state.oticaIndicadaJaPerguntou = true;
    }
    
    // Detect if asked for name
    if (/seu nome|qual.*nome|como posso te chamar|nome completo/i.test(content)) {
      state.nomeJaColetou = true;
    }
    
    // Detect if asked for email
    if (/seu e-?mail|qual.*e-?mail|endere[çc]o de e-?mail/i.test(content)) {
      state.emailJaColetou = true;
    }
  }

  // Enhanced time detection function - ONLY detects explicit time selections
  // This should NOT detect generic phrases like "quero agendar" or "tenho interesse"
  const detectTimeSelection = (content: string, hasTimeContext: boolean = false): { detected: boolean; time: string | null } => {
    const lowerContent = content.toLowerCase().trim();
    
    // Pattern 1: Explicit time with "às" - "às 09", "às 9h", "às 14:30"
    const asTimeMatch = lowerContent.match(/[àa]s\s+(\d{1,2})(?:[h:]\d{0,2})?/i);
    if (asTimeMatch) {
      return { detected: true, time: asTimeMatch[0] };
    }
    
    // Pattern 2: Direct time format - "9h", "09:30", "14h30" (must have h or :)
    const directTimeMatch = lowerContent.match(/\b(\d{1,2})[h:]\d{0,2}/i);
    if (directTimeMatch) {
      return { detected: true, time: directTimeMatch[0] };
    }
    
    // Pattern 3: Selection words ONLY when context suggests time was offered
    // Must be specific selection words, not generic "quero"
    if (hasTimeContext) {
      // Only match ordinal selections or explicit choice phrases
      if (/(?:primeiro|segundo|terceiro|essa?\s+(?:op[çc][aã]o|hor[aá]rio)|op[çc][aã]o\s*(?:1|2|um|dois))/i.test(lowerContent)) {
        return { detected: true, time: 'opção selecionada' };
      }
    }
    
    return { detected: false, time: null };
  };

  // Get last assistant message
  if (assistantMessages.length > 0) {
    state.ultimaPerguntaAgente = assistantMessages[assistantMessages.length - 1].content;
  }

  // Check if last agent message was offering times
  const lastAgentOfferedTimes = state.ultimaPerguntaAgente && 
    /(?:hor[aá]rio|disponibilidade|slot|atende\?|às\s*\d|te atende)/i.test(state.ultimaPerguntaAgente);

  // Check conversation history for time offers and selections
  // We need to track which assistant message offered times, and if the next user message selected
  for (let i = 0; i < conversationHistory.length; i++) {
    const msg = conversationHistory[i];
    if (msg.role === 'user') {
      // Check if previous message (if assistant) offered times
      const prevMsg = i > 0 ? conversationHistory[i - 1] : null;
      const prevOfferedTimes = prevMsg?.role === 'assistant' && 
        /(?:hor[aá]rio|disponibilidade|slot|atende\?|às\s*\d|te atende)/i.test(prevMsg.content);
      
      const detection = detectTimeSelection(msg.content, prevOfferedTimes);
      if (detection.detected) {
        state.horarioJaEscolhido = true;
        state.horarioEscolhido = detection.time;
      }
    }
  }

  // Extract times from last agent message if it offered multiple times
  if (lastAgentOfferedTimes && state.ultimaPerguntaAgente) {
    // Look for multiple time patterns like "09:00 ou 09:23" or "às 09 ou às 10"
    const timePattern = /(\d{1,2}[h:]\d{0,2})/gi;
    const timesFound = state.ultimaPerguntaAgente.match(timePattern);
    if (timesFound && timesFound.length >= 2) {
      state.horariosOferecidos = timesFound.slice(0, 2).join(' ou ');
    }
  }

  // CRITICAL: Also check current user message (the one being sent now)
  if (currentUserMessage) {
    const lowerMessage = currentUserMessage.toLowerCase().trim();
    
    // Only pass context if agent just offered times
    const currentDetection = detectTimeSelection(currentUserMessage, !!lastAgentOfferedTimes);
    if (currentDetection.detected) {
      state.horarioJaEscolhido = true;
      state.horarioEscolhido = currentDetection.time;
      console.log(`[DETECT-STATE] Time detected in CURRENT message: "${currentUserMessage}" => ${currentDetection.time}`);
    }
    
    // Check for AMBIGUOUS response when multiple times were offered
    // "pode ser", "sim", "ok" WITHOUT specifying which time
    if (lastAgentOfferedTimes && state.horariosOferecidos && !state.horarioJaEscolhido) {
      const genericAffirmative = /^(?:pode\s*(?:ser)?|sim|ok|beleza|bom|ta\s*bom|t[áa]\s*(?:bom|certo)|certo|legal|blz)$/i.test(lowerMessage);
      
      if (genericAffirmative) {
        // User gave generic response but agent offered 2+ times - AMBIGUOUS!
        state.horarioAmbiguo = true;
        state.horarioJaEscolhido = false; // NOT selected yet!
        console.log(`[DETECT-STATE] AMBIGUOUS time response: "${currentUserMessage}" when offered "${state.horariosOferecidos}"`);
      }
    }
    
    // Only mark as selected if it's a SPECIFIC choice
    if (lastAgentOfferedTimes && !state.horarioJaEscolhido && !state.horarioAmbiguo) {
      // Specific ordinal selection or "esse horário" when only one time was offered
      const specificChoice = /^(?:esse|essa|primeiro|segundo|o\s*primeiro|o\s*segundo)$/i.test(lowerMessage);
      if (specificChoice) {
        state.horarioJaEscolhido = true;
        state.horarioEscolhido = 'opção específica selecionada';
        console.log(`[DETECT-STATE] Specific time selection: "${currentUserMessage}"`);
      }
    }
  }

  console.log(`[DETECT-STATE] Final state: horarioJaEscolhido=${state.horarioJaEscolhido}, horarioAmbiguo=${state.horarioAmbiguo}, horarioEscolhido=${state.horarioEscolhido}`);

  return state;
};

// Build continuity context for ongoing conversations
const buildContinuityContext = (state: ConversationState): string => {
  const rules: string[] = [];
  
  if (state.saudacaoJaFeita) {
    rules.push('🚫 NÃO cumprimente novamente (Olá, Bom dia, etc) - a conversa já começou');
  }
  
  // CRITICAL: Handle ambiguous time response BEFORE horarioJaEscolhido
  if (state.horarioAmbiguo && state.horariosOferecidos) {
    rules.push(`⚠️ ATENÇÃO: O cliente respondeu genericamente ("pode ser", "ok") mas NÃO escolheu um horário ESPECÍFICO.
Você ofereceu ${state.horariosOferecidos}.
ANTES de perguntar sobre ótica indicada, você DEVE confirmar: "Qual horário te atende melhor? O das ${state.horariosOferecidos}?"
Só avance quando o cliente disser um horário específico (ex: "às 09", "o primeiro", "09h").`);
  } else if (state.horarioJaEscolhido) {
    rules.push(`✅ O CLIENTE JÁ ESCOLHEU UM HORÁRIO (${state.horarioEscolhido || 'confirmado'}). NÃO pergunte "qual horário te atende?" novamente. Próximo passo: coletar dados para confirmar.`);
  }
  
  if (state.oticaIndicadaJaPerguntou) {
    rules.push('✅ Já perguntou sobre ótica indicada - NÃO repita essa pergunta');
  }
  
  if (state.nomeJaColetou) {
    rules.push('✅ Já pediu o nome do cliente - NÃO repita');
  }
  
  if (state.emailJaColetou) {
    rules.push('✅ Já pediu o email do cliente - NÃO repita');
  }
  
  if (rules.length === 0) return '';
  
  return `
## 🔄 CONTINUIDADE DA CONVERSA - REGRAS OBRIGATÓRIAS
${rules.join('\n')}

⚠️ NUNCA reinicie o fluxo do zero após uma resposta curta ("não", "ok", "sim").
⚠️ Continue de onde parou, avançando para o próximo passo.`;
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
    let slotsWithIso: Array<{ formatted: string; iso: string }> = [];
    
    if (hasCalendarIntegration) {
      let slotsInfo = '';
      if (prefetchedSlots.length > 0) {
        // Store both formatted and ISO times for tool reference
        slotsWithIso = prefetchedSlots.slice(0, 6).map((slot) => ({
          formatted: formatSlotBR(slot.start_time),
          iso: slot.start_time,
        }));
        
        const slotsFormatted = slotsWithIso.map((slot, i) => {
          return `  ${i + 1}. ${slot.formatted} (ISO: ${slot.iso})`;
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
## 🗓️ CALENDLY CONECTADO - AGENDAMENTO REAL ATIVO
${slotsInfo}

### 🚨 REGRAS DE AGENDAMENTO 🚨
1. PRIMEIRA MENSAGEM: ofereça slot1 (${slot1Formatted}) e slot2 (${slot2Formatted})
2. SE CLIENTE PEDIR OUTROS HORÁRIOS (terça, outra semana, etc.): use get_available_times
3. Existem ${prefetchedSlots.length} horários disponíveis no total - NUNCA diga que só há 2
4. NUNCA invente datas ou horários - use apenas valores retornados pela ferramenta
5. Para AGENDAR: colete NOME (obrigatório), email é OPCIONAL (sistema gera automaticamente)
6. SEMPRE confirme o agendamento após criar com sucesso
7. Se cliente já escolheu horário, NÃO ofereça novos horários - avance para coleta de dados`;
    }

    // Detect conversation state for anti-repetition - INCLUDE CURRENT MESSAGE
    const conversationState = detectConversationState(conversationHistory, userMessage);
    const continuityContext = buildContinuityContext(conversationState);
    
    console.log(`[TEST-AI-AGENT] Current userMessage: "${userMessage}"`);
    console.log(`[TEST-AI-AGENT] Conversation state: ${JSON.stringify(conversationState)}`);

    // Build system prompt with REPLACED content
    const systemPrompt = `## DATA E HORA ATUAIS (OBRIGATÓRIO)
- Hoje é ${dataAtualFormatada}
- Agora são ${horaAtual} (horário de Brasília)
- O ano atual é ${anoAtual}

Você é ${agent.agent_name}, um assistente virtual.
${continuityContext}

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
${hasCalendarIntegration ? `- PRIMEIRA OFERTA: use slot1 (${slot1Formatted}) e slot2 (${slot2Formatted})
- CLIENTE QUER OUTROS HORÁRIOS? Use get_available_times (há ${prefetchedSlots.length} slots!)
- NÃO diga que só existem 2 horários - use a ferramenta para buscar mais
- EMAIL É OPCIONAL - se cliente não tiver, prossiga apenas com nome e telefone` : ''}
${conversationState.horarioJaEscolhido ? `
⚠️ ATENÇÃO: O cliente JÁ ESCOLHEU um horário. NÃO pergunte "qual horário te atende?" novamente.
Próximo passo: coletar nome (obrigatório) e telefone/email para confirmar o agendamento.` : ''}`;

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

    // Prepare request body with tools if calendar is connected
    const requestBody: Record<string, unknown> = {
      model: "google/gemini-2.5-flash",
      messages,
    };
    
    if (hasCalendarIntegration) {
      requestBody.tools = getCalendlyTools();
      requestBody.tool_choice = "auto";
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
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
    const aiMessage = aiData.choices?.[0]?.message;
    let response = aiMessage?.content || '';
    
    // Track if booking was created
    let bookingCreated = false;
    let bookingDetails: Record<string, unknown> | null = null;

    // === PROCESS TOOL CALLS ===
    if (aiMessage?.tool_calls && aiMessage.tool_calls.length > 0) {
      console.log(`[TEST-AI-AGENT] Processing ${aiMessage.tool_calls.length} tool calls`);
      
      const toolResults: Array<{ role: string; tool_call_id: string; content: string }> = [];
      
      for (const toolCall of aiMessage.tool_calls) {
        const functionName = toolCall.function?.name;
        let args: Record<string, unknown> = {};
        
        try {
          args = JSON.parse(toolCall.function?.arguments || '{}');
        } catch {
          console.error('[TEST-AI-AGENT] Failed to parse tool arguments');
        }
        
        console.log(`[TEST-AI-AGENT] Tool call: ${functionName}`, args);
        
        let toolResult = '';
        
        if (functionName === 'get_available_times') {
          // Fetch available times
          const startDate = args.start_date as string || new Date().toISOString().split('T')[0];
          const endDate = args.end_date as string || new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          
          const times = await fetchCalendlyAvailableTimes(supabaseUrl, agentId, startDate, endDate);
          
          if (times && times.length > 0) {
            const timesFormatted = times.slice(0, 8).map(t => ({
              formatted: formatSlotBR(t.start_time),
              iso: t.start_time,
            }));
            toolResult = JSON.stringify({ success: true, availableTimes: timesFormatted });
          } else {
            toolResult = JSON.stringify({ success: false, error: 'Nenhum horário disponível' });
          }
        } else if (functionName === 'create_booking') {
          // Create booking
          const startTime = args.start_time as string;
          const inviteeName = args.invitee_name as string;
          let inviteeEmail = args.invitee_email as string | undefined;
          const inviteePhone = args.invitee_phone as string | undefined;
          
          // Validate required fields (name is mandatory, email is optional)
          if (!startTime || !inviteeName) {
            toolResult = JSON.stringify({ 
              success: false, 
              error: 'Faltam dados obrigatórios: start_time e invitee_name são necessários' 
            });
          } else {
            // Generate email automatically if not provided
            if (!inviteeEmail) {
              if (inviteePhone) {
                // Clean phone and create email
                const cleanPhone = inviteePhone.replace(/\D/g, '');
                inviteeEmail = `${cleanPhone}@paciente.csv.com`;
                console.log(`[TEST-AI-AGENT] Generated email from phone: ${inviteeEmail}`);
              } else {
                // Generate random email
                const randomId = Math.random().toString(36).substring(2, 10);
                inviteeEmail = `cliente-${randomId}@paciente.csv.com`;
                console.log(`[TEST-AI-AGENT] Generated random email: ${inviteeEmail}`);
              }
            }
            
            const result = await createCalendlyBooking(
              supabaseUrl,
              agentId,
              startTime,
              inviteeName,
              inviteeEmail,
              inviteePhone
            );
            
            if (result.success) {
              bookingCreated = true;
              bookingDetails = result.booking || null;
              toolResult = JSON.stringify({ 
                success: true, 
                message: `Agendamento criado com sucesso para ${inviteeName}!`,
                booking: result.booking,
              });
            } else {
              toolResult = JSON.stringify({ success: false, error: result.error });
            }
          }
        }
        
        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult,
        });
      }
      
      // Make follow-up call with tool results
      const followUpMessages = [
        ...messages,
        aiMessage,
        ...toolResults,
      ];
      
      const followUpResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: followUpMessages,
        }),
      });
      
      if (followUpResponse.ok) {
        const followUpData = await followUpResponse.json();
        response = followUpData.choices?.[0]?.message?.content || response;
      }
    }

    // === GUARDRAIL: Validate response has correct slots (only if no tool calls) ===
    if (!aiMessage?.tool_calls && hasCalendarIntegration && prefetchedSlots.length > 0 && response) {
      const mentionsDates = /\d{1,2}\/\d{1,2}|\d{1,2}h|\d{1,2}:\d{2}/.test(response);
      const hasCorrectSlot = slot1Formatted && response.includes(slot1Formatted.split(' às ')[1] || '');
      
      if (mentionsDates && !hasCorrectSlot) {
        console.log('[TEST-AI-AGENT] Guardrail triggered - response has wrong dates, fixing...');
        
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
        calendlyDebug: {
          ...calendlyDebug,
          bookingCreated,
          bookingDetails,
        },
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
