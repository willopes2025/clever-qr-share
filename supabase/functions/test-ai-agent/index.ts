import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
      console.error("Error fetching agent:", agentError);
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

    // Build system prompt
    const systemPrompt = `Você é ${agent.agent_name}, um assistente virtual.

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

INSTRUÇÕES:
- Este é um TESTE de simulação. Responda como se estivesse em uma conversa real via WhatsApp.
- Mantenha respostas curtas e naturais.
- Use a personalidade e regras definidas acima.
- Use a base de conhecimento para responder perguntas específicas.
- Se não souber algo, use a mensagem de fallback.`;

    // Build messages array for API
    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.map((msg: any) => ({
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
      console.error("AI API error:", aiResponse.status, errorText);
      
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
    const response = aiData.choices?.[0]?.message?.content;

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
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in test-ai-agent:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
