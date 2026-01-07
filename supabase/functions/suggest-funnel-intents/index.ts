import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agentConfigId, stages } = await req.json();

    if (!agentConfigId || !stages || stages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'agentConfigId and stages are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch agent config
    const { data: agentConfig, error: agentError } = await supabase
      .from('ai_agent_configs')
      .select('*')
      .eq('id', agentConfigId)
      .single();

    if (agentError || !agentConfig) {
      console.error('Error fetching agent config:', agentError);
      return new Response(
        JSON.stringify({ error: 'Agent config not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch knowledge items
    const { data: knowledgeItems } = await supabase
      .from('ai_agent_knowledge_items')
      .select('title, content, processed_content, source_type')
      .eq('agent_config_id', agentConfigId)
      .eq('status', 'processed');

    // Build context from agent and knowledge
    const agentContext = `
Nome do Agente: ${agentConfig.agent_name}
Personalidade: ${agentConfig.personality_prompt || 'Não definida'}
Regras de Comportamento: ${agentConfig.behavior_rules || 'Não definidas'}
Mensagem de Saudação: ${agentConfig.greeting_message || 'Não definida'}
    `.trim();

    const knowledgeContext = knowledgeItems?.length 
      ? knowledgeItems.map(k => `[${k.source_type}] ${k.title}: ${k.processed_content || k.content || ''}`).join('\n\n')
      : 'Nenhuma base de conhecimento disponível';

    const stagesDescription = stages.map((s: { id: string; name: string }) => `- ${s.name} (ID: ${s.id})`).join('\n');

    // Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `Você é um especialista em vendas e funis de conversão. Sua tarefa é analisar o contexto de um agente de IA de atendimento e sugerir intenções de cliente que podem ser detectadas nas mensagens, mapeando cada intenção para uma etapa do funil.

CONTEXTO DO AGENTE:
${agentContext}

BASE DE CONHECIMENTO:
${knowledgeContext}

ETAPAS DO FUNIL DISPONÍVEIS:
${stagesDescription}

INSTRUÇÕES:
1. Analise o contexto do agente e sua base de conhecimento
2. Identifique possíveis intenções de clientes baseadas no negócio
3. Para cada intenção, sugira a etapa do funil mais adequada
4. Gere entre 4 e 8 intenções relevantes
5. Use palavras-chave que os clientes provavelmente usariam

Você DEVE responder chamando a função suggest_intents com as intenções sugeridas.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Gere sugestões de intenções para este agente de IA, considerando as etapas do funil disponíveis.' }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'suggest_intents',
              description: 'Retorna sugestões de intenções de cliente mapeadas para etapas do funil',
              parameters: {
                type: 'object',
                properties: {
                  suggestions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        intent: { 
                          type: 'string', 
                          description: 'Palavras-chave da intenção separadas por vírgula (ex: "comprar, adquirir, quero")' 
                        },
                        description: { 
                          type: 'string', 
                          description: 'Breve descrição da intenção' 
                        },
                        suggested_stage_id: { 
                          type: 'string', 
                          description: 'ID da etapa do funil sugerida para esta intenção' 
                        }
                      },
                      required: ['intent', 'description', 'suggested_stage_id'],
                      additionalProperties: false
                    }
                  }
                },
                required: ['suggestions'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'suggest_intents' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log('AI Response:', JSON.stringify(aiResponse, null, 2));

    // Extract tool call result
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'suggest_intents') {
      throw new Error('Invalid AI response format');
    }

    const suggestions = JSON.parse(toolCall.function.arguments);
    
    return new Response(
      JSON.stringify(suggestions),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in suggest-funnel-intents:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
