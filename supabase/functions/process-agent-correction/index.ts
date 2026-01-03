import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CorrectionRequest {
  userQuestion: string;
  agentResponse: string;
  userCorrection: string;
  agentName: string;
}

interface CorrectionSuggestion {
  title: string;
  category: string;
  content: string;
  confidence: number;
  reasoning: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userQuestion, agentResponse, userCorrection, agentName } = await req.json() as CorrectionRequest;

    if (!userQuestion || !agentResponse || !userCorrection) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: userQuestion, agentResponse, userCorrection' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `Você é um assistente especializado em analisar correções de respostas de agentes de IA e transformá-las em conhecimento estruturado para a base de conhecimento.

Sua tarefa é:
1. Analisar a pergunta original do usuário
2. Entender por que a resposta do agente estava incorreta ou incompleta
3. Extrair a informação correta da correção fornecida
4. Formatar como conhecimento reutilizável (não apenas para aquela pergunta específica)
5. Sugerir um título conciso e categoria apropriada

IMPORTANTE:
- O conteúdo deve ser genérico o suficiente para responder perguntas similares
- Mantenha o tom e estilo apropriado para um agente de atendimento
- A categoria deve ser uma das: "Informações Gerais", "Produtos/Serviços", "Atendimento", "Políticas", "Horários/Localização", "Preços", "Processos", "FAQ"

Responda APENAS em JSON válido com este formato:
{
  "title": "Título conciso do conhecimento",
  "category": "Categoria apropriada",
  "content": "Conteúdo formatado para a base de conhecimento",
  "confidence": 85,
  "reasoning": "Explicação breve do que foi entendido e por que a correção é importante"
}`;

    const userPrompt = `Agente: ${agentName}

PERGUNTA DO USUÁRIO:
"${userQuestion}"

RESPOSTA DO AGENTE (INCORRETA/INCOMPLETA):
"${agentResponse}"

CORREÇÃO DO USUÁRIO:
"${userCorrection}"

Analise a correção e gere o conhecimento estruturado.`;

    console.log('Processing correction for agent:', agentName);
    console.log('User question:', userQuestion);
    console.log('Agent response:', agentResponse);
    console.log('User correction:', userCorrection);

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
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos à sua conta.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiContent = data.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error('No response from AI');
    }

    console.log('AI response:', aiContent);

    // Parse JSON response
    let suggestion: CorrectionSuggestion;
    try {
      // Remove markdown code blocks if present
      const cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      suggestion = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Fallback: create a basic suggestion from the correction
      suggestion = {
        title: 'Correção de Resposta',
        category: 'FAQ',
        content: userCorrection,
        confidence: 60,
        reasoning: 'Não foi possível processar a correção automaticamente. O conteúdo foi preservado para revisão manual.'
      };
    }

    // Validate and ensure required fields
    suggestion = {
      title: suggestion.title || 'Correção de Resposta',
      category: suggestion.category || 'FAQ',
      content: suggestion.content || userCorrection,
      confidence: typeof suggestion.confidence === 'number' ? suggestion.confidence : 70,
      reasoning: suggestion.reasoning || 'Correção processada com sucesso.'
    };

    console.log('Final suggestion:', suggestion);

    return new Response(
      JSON.stringify({ suggestion }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing correction:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro ao processar correção' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
