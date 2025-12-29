import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Template base data (simplified versions for personalization)
const TEMPLATE_BASES: Record<string, { name: string; role: string; focus: string }> = {
  sdr: {
    name: "SDR Virtual",
    role: "Sales Development Representative",
    focus: "qualificação de leads e agendamento de reuniões"
  },
  receptionist: {
    name: "Recepcionista Virtual",
    role: "Recepcionista e atendente",
    focus: "atendimento inicial e direcionamento de clientes"
  },
  sales: {
    name: "Vendedor Virtual",
    role: "Consultor de Vendas",
    focus: "apresentação de produtos/serviços e fechamento de vendas"
  },
  customer_support: {
    name: "Suporte ao Cliente",
    role: "Especialista em Suporte",
    focus: "resolução de dúvidas e problemas de clientes"
  },
  scheduler: {
    name: "Agendador Virtual",
    role: "Assistente de Agendamentos",
    focus: "agendamento e confirmação de compromissos"
  },
  followup: {
    name: "Especialista em Follow-up",
    role: "Especialista em Acompanhamento",
    focus: "acompanhamento de leads e clientes"
  },
  faq: {
    name: "Assistente FAQ",
    role: "Assistente de Informações",
    focus: "responder perguntas frequentes"
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { templateId, companyContext } = await req.json();

    if (!templateId || !companyContext) {
      return new Response(
        JSON.stringify({ error: 'templateId e companyContext são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const templateBase = TEMPLATE_BASES[templateId];
    if (!templateBase) {
      return new Response(
        JSON.stringify({ error: 'Template não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    const systemPrompt = `Você é um especialista em criar configurações de agentes de IA para atendimento via WhatsApp.
Sua tarefa é personalizar um template de agente com base no contexto da empresa fornecido.

REGRAS IMPORTANTES:
1. Mantenha as mensagens curtas e adequadas para WhatsApp (máximo 200 caracteres por mensagem)
2. Use linguagem profissional mas amigável
3. Adapte o tom ao tipo de negócio da empresa
4. Use o nome da empresa quando apropriado
5. Mantenha o foco no papel do agente: ${templateBase.role} com foco em ${templateBase.focus}

Responda APENAS com JSON válido, sem markdown, sem explicações.`;

    const userPrompt = `Personalize este agente para a seguinte empresa:

CONTEXTO DA EMPRESA:
${companyContext}

TEMPLATE BASE:
- Tipo: ${templateBase.name}
- Papel: ${templateBase.role}
- Foco: ${templateBase.focus}

Retorne um JSON com exatamente estes campos:
{
  "agentName": "Nome do agente personalizado para a empresa",
  "personalityPrompt": "Prompt de personalidade adaptado para a empresa (2-3 parágrafos)",
  "behaviorRules": "Regras de comportamento específicas (lista com bullets usando •)",
  "greetingMessage": "Mensagem de saudação personalizada (max 150 chars)",
  "goodbyeMessage": "Mensagem de despedida personalizada (max 100 chars)",
  "fallbackMessage": "Mensagem quando não entender (max 120 chars)",
  "handoffKeywords": ["lista", "de", "palavras", "para", "transferir", "para", "humano"]
}`;

    console.log('Calling Lovable AI to personalize template:', templateId);

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
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos ao seu workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Resposta vazia da IA');
    }

    console.log('AI response received, parsing...');

    // Clean and parse JSON response
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.slice(7);
    }
    if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.slice(3);
    }
    if (cleanedContent.endsWith('```')) {
      cleanedContent = cleanedContent.slice(0, -3);
    }
    cleanedContent = cleanedContent.trim();

    let personalizedData = JSON.parse(cleanedContent);

    // Normalize data types to expected format
    // behaviorRules: always string
    if (Array.isArray(personalizedData.behaviorRules)) {
      personalizedData.behaviorRules = personalizedData.behaviorRules.join('\n');
    } else if (typeof personalizedData.behaviorRules !== 'string') {
      personalizedData.behaviorRules = '';
    }

    // handoffKeywords: always string[]
    if (typeof personalizedData.handoffKeywords === 'string') {
      personalizedData.handoffKeywords = personalizedData.handoffKeywords.split(',').map((k: string) => k.trim()).filter(Boolean);
    } else if (!Array.isArray(personalizedData.handoffKeywords)) {
      personalizedData.handoffKeywords = ['falar com humano', 'atendente', 'gerente'];
    }

    // Validate required fields
    const requiredFields = ['agentName', 'personalityPrompt', 'greetingMessage', 'goodbyeMessage', 'fallbackMessage'];
    for (const field of requiredFields) {
      if (!personalizedData[field]) {
        throw new Error(`Campo obrigatório ausente: ${field}`);
      }
    }

    console.log('Template personalized successfully:', personalizedData.agentName);

    return new Response(
      JSON.stringify(personalizedData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in personalize-agent-template:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro ao personalizar template' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
