import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agentConfigId } = await req.json();

    if (!agentConfigId) {
      return new Response(
        JSON.stringify({ error: 'agentConfigId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch agent configuration
    const { data: agentConfig, error: agentError } = await supabase
      .from('ai_agent_configs')
      .select('agent_name, personality_prompt, behavior_rules')
      .eq('id', agentConfigId)
      .single();

    if (agentError || !agentConfig) {
      console.error("Error fetching agent config:", agentError);
      return new Response(
        JSON.stringify({ error: 'Agent configuration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch knowledge items for context
    const { data: knowledgeItems } = await supabase
      .from('ai_agent_knowledge_items')
      .select('title, processed_content')
      .eq('agent_config_id', agentConfigId)
      .eq('status', 'completed')
      .limit(5);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SUGGEST-INTENTS] Generating intents for agent: ${agentConfig.agent_name}`);

    const knowledgeContext = knowledgeItems?.length 
      ? `\n\nConhecimento disponível:\n${knowledgeItems.map(k => `- ${k.title}`).join('\n')}`
      : '';

    const systemPrompt = `Você é um especialista em design de chatbots. Sua tarefa é sugerir intenções comuns que os usuários podem ter ao interagir com este chatbot.

Para cada intenção, forneça:
- label: Nome curto e descritivo (máximo 3 palavras)
- description: Descrição clara da intenção (máximo 15 palavras)

Você DEVE responder usando a ferramenta suggest_intents.`;

    const userPrompt = `Assistente: ${agentConfig.agent_name}

Personalidade:
${agentConfig.personality_prompt || 'Assistente geral'}

Regras de comportamento:
${agentConfig.behavior_rules || 'Não definidas'}${knowledgeContext}

Gere 4-6 intenções relevantes para este assistente.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
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
              name: "suggest_intents",
              description: "Return 4-6 intent suggestions for the chatbot",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string", description: "Short intent name (max 3 words)" },
                        description: { type: "string", description: "Clear intent description (max 15 words)" }
                      },
                      required: ["label", "description"]
                    }
                  }
                },
                required: ["suggestions"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "suggest_intents" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded" }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required" }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", data);
      return new Response(
        JSON.stringify({ error: "Invalid AI response" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const suggestions = JSON.parse(toolCall.function.arguments);
    console.log(`[SUGGEST-INTENTS] Generated ${suggestions.suggestions?.length || 0} intents`);

    return new Response(
      JSON.stringify(suggestions),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("[SUGGEST-INTENTS] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
