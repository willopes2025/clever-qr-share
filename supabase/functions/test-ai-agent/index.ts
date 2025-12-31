import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Check if message is asking about scheduling/availability
const isAskingAboutSchedule = (message: string): boolean => {
  const scheduleKeywords = [
    'horário', 'horarios', 'hora', 'agendar', 'agenda', 'marcar', 
    'disponível', 'disponibilidade', 'reunião', 'reuniao', 'meeting',
    'quando', 'que horas', 'amanhã', 'amanha', 'próxima', 'proxima',
    'semana', 'dia', 'calendário', 'calendario', 'livre', 'vaga'
  ];
  const lowerMessage = message.toLowerCase();
  return scheduleKeywords.some(keyword => lowerMessage.includes(keyword));
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

// Define tools for AI agent (Calendly)
const getCalendlyTools = () => [
  {
    type: 'function',
    function: {
      name: 'get_available_times',
      description: 'Busca horários disponíveis para agendamento no Calendly. Use quando o cliente perguntar sobre horários disponíveis ou quiser agendar.',
      parameters: {
        type: 'object',
        properties: {
          start_date: { 
            type: 'string', 
            description: 'Data de início para buscar horários (formato YYYY-MM-DD). Use a data de hoje ou a data mencionada pelo cliente.' 
          },
          end_date: { 
            type: 'string', 
            description: 'Data de fim para buscar horários (formato YYYY-MM-DD). Máximo 7 dias após start_date.' 
          },
        },
        required: ['start_date', 'end_date'],
      },
    },
  },
];

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

    // Build calendar context
    let calendarContext = '';
    if (hasCalendarIntegration) {
      calendarContext = `\n\n## AGENDAMENTO DISPONÍVEL (CALENDLY)

### 🚨 REGRA OBRIGATÓRIA 🚨
Quando o cliente quiser agendar ou mencionar qualquer horário:
1. SEMPRE chame get_available_times PRIMEIRO
2. NUNCA confirme ou sugira horários sem verificar disponibilidade em tempo real
3. Horários mudam constantemente - verifique SEMPRE antes de responder
4. NUNCA invente horários - use APENAS os retornados pela ferramenta

A ferramenta retorna horários com códigos [A], [B], etc. Liste CADA horário individualmente para o cliente.`;
    }

    // Build system prompt
    const systemPrompt = `## DATA E HORA ATUAIS (OBRIGATÓRIO - USE SEMPRE)
- Hoje é ${dataAtualFormatada}
- Agora são ${horaAtual} (horário de Brasília)
- O ano atual é ${anoAtual}
- NUNCA mencione o ano 2024. Estamos em ${anoAtual}.

Você é ${agent.agent_name}, um assistente virtual.

PERSONALIDADE:
${agent.personality_prompt || "Seja profissional e prestativo."}

REGRAS DE COMPORTAMENTO:
${agent.behavior_rules || "Responda de forma clara e objetiva."}

MENSAGEM DE SAUDAÇÃO (use como referência de tom):
${agent.greeting_message || ""}

MENSAGEM DE DESPEDIDA (use como referência):
${agent.goodbye_message || ""}

MENSAGEM DE FALLBACK (quando não souber responder):
${agent.fallback_message || "Desculpe, não entendi. Pode reformular?"}
${knowledgeText}
${calendarContext}

INSTRUÇÕES:
- Este é um TESTE de simulação. Responda como se estivesse em uma conversa real via WhatsApp.
- Mantenha respostas curtas e naturais.
- Use a personalidade e regras definidas acima.
- Use a base de conhecimento para responder perguntas específicas.
- Se não souber algo, use a mensagem de fallback.
${hasCalendarIntegration ? '- Para agendamentos: SEMPRE use a ferramenta get_available_times antes de mencionar horários.' : ''}`;

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

    // Build AI request with tools if calendar is available
    const aiRequestBody: Record<string, unknown> = {
      model: "google/gemini-2.5-flash",
      messages,
    };

    if (hasCalendarIntegration) {
      aiRequestBody.tools = getCalendlyTools();
      aiRequestBody.tool_choice = "auto";
    }

    console.log(`[TEST-AI-AGENT] Calling AI with tools: ${hasCalendarIntegration}`);

    let aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(aiRequestBody),
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

    let aiData = await aiResponse.json();
    let response = aiData.choices?.[0]?.message?.content || '';
    
    // Process tool calls if present
    const toolCalls = aiData.choices?.[0]?.message?.tool_calls;
    if (toolCalls && toolCalls.length > 0 && hasCalendarIntegration) {
      console.log(`[TEST-AI-AGENT] Processing ${toolCalls.length} tool calls`);
      
      const toolResults: Array<{ role: string; tool_call_id: string; content: string }> = [];
      
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function?.name;
        const args = JSON.parse(toolCall.function?.arguments || '{}');
        
        console.log(`[TEST-AI-AGENT] Executing tool: ${functionName}`, args);
        
        if (functionName === 'get_available_times') {
          const availableTimes = await fetchCalendlyAvailableTimes(
            supabaseUrl,
            agentId,
            args.start_date,
            args.end_date
          );
          
          if (availableTimes && availableTimes.length > 0) {
            console.log(`[TEST-AI-AGENT] Found ${availableTimes.length} available times`);
            
            const timesSlice = availableTimes.slice(0, 10);
            
            // Format times for display
            const listaParaCliente = timesSlice.map((slot, index) => {
              const utcDate = new Date(slot.start_time);
              const codigo = String.fromCharCode(65 + index);
              
              const dataBRT = utcDate.toLocaleDateString('pt-BR', { 
                weekday: 'short',
                day: '2-digit', 
                month: '2-digit',
                timeZone: 'America/Sao_Paulo'
              });
              const horaBRT = utcDate.toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit',
                timeZone: 'America/Sao_Paulo'
              });
              
              return `[${codigo}] ${dataBRT} às ${horaBRT}`;
            }).join('\n');
            
            // Internal mapping
            const mapeamento = timesSlice.map((slot, index) => {
              const codigo = String.fromCharCode(65 + index);
              return `${codigo} = ${slot.start_time}`;
            }).join('\n');
            
            toolResults.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: `## HORÁRIOS DISPONÍVEIS

MOSTRE AO CLIENTE ESTES HORÁRIOS:
${listaParaCliente}

---
⚠️ MAPEAMENTO INTERNO (NÃO MOSTRE AO CLIENTE):
${mapeamento}

---
📋 REGRAS:
1. Liste CADA horário individualmente
2. NÃO agrupe em faixas (ex: "9h às 11h" está ERRADO)
3. Pergunte qual horário o cliente prefere`
            });
          } else {
            toolResults.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: 'Nenhum horário disponível encontrado para o período solicitado. Sugira ao cliente tentar outro dia.'
            });
          }
        }
      }
      
      // If we have tool results, call AI again with the results
      if (toolResults.length > 0) {
        console.log('[TEST-AI-AGENT] Calling AI again with tool results');
        
        const followUpMessages = [
          ...messages,
          aiData.choices[0].message, // Include the assistant's tool call message
          ...toolResults
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
