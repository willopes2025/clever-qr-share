import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Message {
  id: string;
  content: string;
  direction: string;
  created_at: string;
  conversation_id: string;
}

interface ConversationGroup {
  conversationId: string;
  messages: Message[];
}

interface LearningSuggestion {
  question: string;
  answer: string;
  suggested_title: string;
  category: string;
  confidence_score: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agentConfigId, date } = await req.json();

    if (!agentConfigId) {
      return new Response(
        JSON.stringify({ error: "agentConfigId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get agent config with funnel
    const { data: agentConfig, error: agentError } = await supabase
      .from("ai_agent_configs")
      .select("id, user_id, funnel_id, agent_name")
      .eq("id", agentConfigId)
      .single();

    if (agentError || !agentConfig) {
      console.error("Agent config not found:", agentError);
      return new Response(
        JSON.stringify({ error: "Agent configuration not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine date range
    const analysisDate = date ? new Date(date) : new Date();
    analysisDate.setDate(analysisDate.getDate() - 1); // Yesterday by default
    const startOfDay = new Date(analysisDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(analysisDate);
    endOfDay.setHours(23, 59, 59, 999);

    console.log(`Analyzing conversations from ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);

    // Get conversations with AI handled or from the funnel
    let conversationsQuery = supabase
      .from("conversations")
      .select("id, contact_id")
      .eq("user_id", agentConfig.user_id)
      .eq("ai_handled", true)
      .gte("last_message_at", startOfDay.toISOString())
      .lte("last_message_at", endOfDay.toISOString());

    // If funnel is linked, also filter by deals in that funnel
    if (agentConfig.funnel_id) {
      const { data: funnelDeals } = await supabase
        .from("funnel_deals")
        .select("contact_id")
        .eq("funnel_id", agentConfig.funnel_id);

      if (funnelDeals && funnelDeals.length > 0) {
        const contactIds = funnelDeals.map(d => d.contact_id);
        conversationsQuery = conversationsQuery.in("contact_id", contactIds);
      }
    }

    const { data: conversations, error: convError } = await conversationsQuery;

    if (convError) {
      console.error("Error fetching conversations:", convError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch conversations" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!conversations || conversations.length === 0) {
      console.log("No conversations found for analysis");
      return new Response(
        JSON.stringify({ message: "No conversations found for analysis", suggestions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${conversations.length} conversations to analyze`);

    // Get messages from these conversations
    const conversationIds = conversations.map(c => c.id);
    const { data: messages, error: msgError } = await supabase
      .from("inbox_messages")
      .select("id, content, direction, created_at, conversation_id")
      .in("conversation_id", conversationIds)
      .eq("message_type", "text")
      .not("content", "is", null)
      .order("created_at", { ascending: true });

    if (msgError) {
      console.error("Error fetching messages:", msgError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch messages" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!messages || messages.length < 2) {
      console.log("Not enough messages for analysis");
      return new Response(
        JSON.stringify({ message: "Not enough messages for analysis", suggestions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Analyzing ${messages.length} messages`);

    // Group messages by conversation
    const conversationGroups: ConversationGroup[] = [];
    const grouped = new Map<string, Message[]>();

    for (const msg of messages) {
      if (!grouped.has(msg.conversation_id)) {
        grouped.set(msg.conversation_id, []);
      }
      grouped.get(msg.conversation_id)!.push(msg);
    }

    for (const [conversationId, msgs] of grouped) {
      conversationGroups.push({ conversationId, messages: msgs });
    }

    // Build prompt for AI analysis
    const conversationTexts = conversationGroups.map((group, idx) => {
      const messageTexts = group.messages.map(m => 
        `${m.direction === 'inbound' ? 'CLIENTE' : 'AGENTE'}: ${m.content}`
      ).join('\n');
      return `--- CONVERSA ${idx + 1} ---\n${messageTexts}`;
    }).join('\n\n');

    const systemPrompt = `Você é um especialista em análise de conversas de atendimento ao cliente.
Sua tarefa é identificar perguntas frequentes dos CLIENTES e suas respostas para construir uma base de conhecimento (FAQ).

REGRAS CRÍTICAS - LEIA COM ATENÇÃO:

1. PERGUNTA = SOMENTE mensagens que começam com "CLIENTE:" que expressam uma DÚVIDA REAL ou PEDIDO DE INFORMAÇÃO
   - O cliente está PERGUNTANDO algo que não sabe
   - Exemplos válidos: "Qual o valor?", "Vocês atendem convênio?", "Como funciona?", "Qual a forma de pagamento?"

2. RESPOSTA = A mensagem do "AGENTE:" que responde aquela pergunta do cliente

3. IGNORE COMPLETAMENTE perguntas feitas pelo AGENTE:
   - "Que dia seria bom para você?" ❌ (isso é o agente perguntando, NÃO o cliente)
   - "Qual horário você prefere?" ❌ (técnica de vendas do agente)
   - "Você já usa óculos?" ❌ (qualificação feita pelo agente)
   - "Posso te ajudar com algo?" ❌ (abordagem do agente)

4. IGNORE respostas curtas ou confirmações do cliente:
   - "Sim", "Não", "Ok", "Pode ser", "Qualquer horário" ❌ (não são perguntas)

5. Classifique em categorias: FAQ, Produto, Preço, Prazo, Pagamento, Suporte, Objeção, Outro
6. Score de confiança 0.5 a 1.0 baseado na qualidade
7. Máximo de 10 sugestões

EXEMPLOS CORRETOS DE EXTRAÇÃO:
✅ CLIENTE: "Qual o valor do exame?" → AGENTE: "O exame custa R$29,99" (pergunta do cliente sobre preço)
✅ CLIENTE: "Vocês atendem Unimed?" → AGENTE: "Não atendemos convênios, mas temos preço especial" (dúvida sobre convênio)
✅ CLIENTE: "Precisa de pedido médico?" → AGENTE: "Não precisa, você pode agendar diretamente" (dúvida sobre procedimento)

EXEMPLOS INCORRETOS - NÃO EXTRAIR:
❌ AGENTE: "Que dia da semana seria bom para você?" (isso é pergunta do AGENTE, não do cliente)
❌ AGENTE: "Você prefere manhã ou tarde?" (qualificação do agente)
❌ CLIENTE: "Pode ser segunda" (não é uma pergunta, é uma resposta do cliente)`;

    const userPrompt = `Analise as seguintes conversas e extraia sugestões de conhecimento:

${conversationTexts}`;

    // Call Lovable AI with tool calling
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_knowledge_suggestions",
              description: "Extract question/answer pairs for AI agent knowledge base",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question: { 
                          type: "string", 
                          description: "The question asked by the customer" 
                        },
                        answer: { 
                          type: "string", 
                          description: "The answer provided by the agent" 
                        },
                        suggested_title: { 
                          type: "string", 
                          description: "A short title for this knowledge item" 
                        },
                        category: { 
                          type: "string", 
                          enum: ["FAQ", "Produto", "Preço", "Prazo", "Pagamento", "Suporte", "Objeção", "Outro"]
                        },
                        confidence_score: { 
                          type: "number", 
                          description: "Confidence score from 0.5 to 1.0" 
                        }
                      },
                      required: ["question", "answer", "suggested_title", "category", "confidence_score"]
                    }
                  }
                },
                required: ["suggestions"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_knowledge_suggestions" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits required. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI analysis failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    console.log("AI response:", JSON.stringify(aiData, null, 2));

    let suggestions: LearningSuggestion[] = [];

    // Extract suggestions from tool call
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall && toolCall.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        suggestions = args.suggestions || [];
      } catch (e) {
        console.error("Failed to parse tool call arguments:", e);
      }
    }

    if (suggestions.length === 0) {
      console.log("No suggestions extracted from AI");
      return new Response(
        JSON.stringify({ message: "No learning suggestions identified", suggestions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Extracted ${suggestions.length} suggestions`);

    // Get a sample conversation ID for reference
    const sampleConversationId = conversationGroups[0]?.conversationId;

    // Save suggestions to database
    const suggestionsToInsert = suggestions.map(s => ({
      agent_config_id: agentConfigId,
      user_id: agentConfig.user_id,
      question: s.question,
      answer: s.answer,
      suggested_title: s.suggested_title,
      category: s.category,
      confidence_score: Math.min(1, Math.max(0.5, s.confidence_score)),
      source_conversation_id: sampleConversationId,
      analysis_date: analysisDate.toISOString().split('T')[0],
      status: 'pending'
    }));

    const { data: insertedSuggestions, error: insertError } = await supabase
      .from("ai_knowledge_suggestions")
      .insert(suggestionsToInsert)
      .select();

    if (insertError) {
      console.error("Error inserting suggestions:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to save suggestions", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Saved ${insertedSuggestions?.length || 0} suggestions`);

    return new Response(
      JSON.stringify({ 
        message: "Analysis complete",
        suggestionsCount: insertedSuggestions?.length || 0,
        suggestions: insertedSuggestions
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in analyze-agent-learning:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
