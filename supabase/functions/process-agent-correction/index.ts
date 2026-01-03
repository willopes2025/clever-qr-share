import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CorrectionRequest {
  userQuestion: string;
  agentResponse: string;
  userCorrection: string;
  agentName: string;
  agentId: string;
}

type TargetSection = 
  | 'personality_prompt' 
  | 'behavior_rules' 
  | 'greeting_message' 
  | 'fallback_message' 
  | 'goodbye_message' 
  | 'knowledge';

interface CorrectionSuggestion {
  targetSection: TargetSection;
  targetSectionLabel: string;
  currentContent: string;
  suggestedEdit: {
    type: 'append' | 'replace' | 'prepend';
    newContent: string;
    previewFull: string;
  };
  confidence: number;
  reasoning: string;
}

const SECTION_LABELS: Record<TargetSection, string> = {
  personality_prompt: 'Personalidade',
  behavior_rules: 'Regras de Comportamento',
  greeting_message: 'Mensagem de Saudação',
  fallback_message: 'Mensagem de Fallback',
  goodbye_message: 'Mensagem de Despedida',
  knowledge: 'Base de Conhecimento',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userQuestion, agentResponse, userCorrection, agentName, agentId } = await req.json() as CorrectionRequest;

    if (!userQuestion || !agentResponse || !userCorrection || !agentId) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: userQuestion, agentResponse, userCorrection, agentId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured');
    }

    // Fetch agent configuration
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: agentConfig, error: configError } = await supabase
      .from('ai_agent_configs')
      .select('*')
      .eq('id', agentId)
      .single();

    if (configError || !agentConfig) {
      console.error('Error fetching agent config:', configError);
      throw new Error('Configuração do agente não encontrada');
    }

    console.log('Agent config loaded:', {
      id: agentConfig.id,
      name: agentConfig.agent_name,
      hasPersonality: !!agentConfig.personality_prompt,
      hasBehaviorRules: !!agentConfig.behavior_rules,
    });

    const systemPrompt = `Você é um assistente especializado em analisar correções de respostas de agentes de IA e identificar EXATAMENTE onde a correção deve ser aplicada na configuração do agente.

SEÇÕES DISPONÍVEIS PARA EDIÇÃO:
1. personality_prompt - Personalidade e identidade do agente (tom de voz, estilo de comunicação)
2. behavior_rules - Regras de comportamento e procedimentos obrigatórios
3. greeting_message - Mensagem de saudação inicial
4. fallback_message - Mensagem quando não sabe responder
5. goodbye_message - Mensagem de despedida
6. knowledge - Base de conhecimento (informações factuais, FAQs)

CONFIGURAÇÃO ATUAL DO AGENTE:
---
personality_prompt:
${agentConfig.personality_prompt || '(vazio)'}
---
behavior_rules:
${agentConfig.behavior_rules || '(vazio)'}
---
greeting_message:
${agentConfig.greeting_message || '(vazio)'}
---
fallback_message:
${agentConfig.fallback_message || '(vazio)'}
---
goodbye_message:
${agentConfig.goodbye_message || '(vazio)'}
---

REGRAS DE DECISÃO:
- Se a correção é sobre COMO o agente deve SE COMPORTAR ou PROCEDIMENTOS → behavior_rules
- Se a correção é sobre ESTILO DE COMUNICAÇÃO ou PERSONALIDADE → personality_prompt
- Se a correção é sobre a PRIMEIRA MENSAGEM enviada ao usuário → greeting_message
- Se a correção é sobre QUANDO NÃO SABE RESPONDER → fallback_message
- Se a correção é sobre ENCERRAR CONVERSA → goodbye_message
- Se a correção é sobre INFORMAÇÃO FACTUAL (preços, horários, dados) → knowledge

REGRAS DE EDIÇÃO:
- Para behavior_rules e personality_prompt: prefira "append" (adicionar ao final) se estiver complementando
- Para mensagens fixas (greeting, fallback, goodbye): use "replace" se precisa mudar completamente
- O "previewFull" deve mostrar EXATAMENTE como ficará o campo após a edição

Responda APENAS em JSON válido com este formato:
{
  "targetSection": "behavior_rules",
  "suggestedEdit": {
    "type": "append",
    "newContent": "Texto que será adicionado/substituído",
    "previewFull": "Conteúdo completo de como ficará a seção após a edição"
  },
  "confidence": 85,
  "reasoning": "Explicação de por que esta seção foi escolhida e como a edição resolve o problema"
}`;

    const userPrompt = `PERGUNTA DO USUÁRIO:
"${userQuestion}"

RESPOSTA DO AGENTE (que precisa ser corrigida):
"${agentResponse}"

CORREÇÃO DO USUÁRIO:
"${userCorrection}"

Analise e identifique em qual seção esta correção deve ser aplicada. Retorne a sugestão de edição.`;

    console.log('Processing correction for agent:', agentName);

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
    let parsed: any;
    try {
      const cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Fallback to knowledge section
      parsed = {
        targetSection: 'knowledge',
        suggestedEdit: {
          type: 'append',
          newContent: userCorrection,
          previewFull: userCorrection,
        },
        confidence: 60,
        reasoning: 'Não foi possível identificar a seção automaticamente. Sugerido adicionar como conhecimento.',
      };
    }

    // Validate targetSection
    const validSections: TargetSection[] = ['personality_prompt', 'behavior_rules', 'greeting_message', 'fallback_message', 'goodbye_message', 'knowledge'];
    const targetSection: TargetSection = validSections.includes(parsed.targetSection) 
      ? parsed.targetSection 
      : 'knowledge';

    // Get current content of the target section
    let currentContent = '';
    if (targetSection !== 'knowledge') {
      currentContent = agentConfig[targetSection] || '';
    }

    // Build the suggestion
    const suggestion: CorrectionSuggestion = {
      targetSection,
      targetSectionLabel: SECTION_LABELS[targetSection],
      currentContent,
      suggestedEdit: {
        type: parsed.suggestedEdit?.type || 'append',
        newContent: parsed.suggestedEdit?.newContent || userCorrection,
        previewFull: parsed.suggestedEdit?.previewFull || userCorrection,
      },
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 70,
      reasoning: parsed.reasoning || 'Correção processada com sucesso.',
    };

    // If type is append, calculate previewFull correctly
    if (suggestion.suggestedEdit.type === 'append' && currentContent && targetSection !== 'knowledge') {
      const separator = currentContent.endsWith('\n') ? '' : '\n';
      suggestion.suggestedEdit.previewFull = currentContent + separator + suggestion.suggestedEdit.newContent;
    } else if (suggestion.suggestedEdit.type === 'prepend' && currentContent && targetSection !== 'knowledge') {
      suggestion.suggestedEdit.previewFull = suggestion.suggestedEdit.newContent + '\n' + currentContent;
    } else if (suggestion.suggestedEdit.type === 'replace' || !currentContent) {
      suggestion.suggestedEdit.previewFull = suggestion.suggestedEdit.newContent;
    }

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
