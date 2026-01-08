import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { category, quantity = 5 } = await req.json();

    if (!category) {
      return new Response(
        JSON.stringify({ error: 'Category is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const categoryNames: Record<string, string> = {
      greeting: 'saudações (Oi, Bom dia, E aí, Olá)',
      casual: 'respostas casuais (Tudo certo, Aqui de boa, Tranquilo)',
      question: 'perguntas simples (O que tá fazendo? Tudo bem?)',
      reaction: 'reações (Haha, Show!, Top, Massa)',
      farewell: 'despedidas (Falou!, Até mais, Tchau)',
    };

    const categoryDescription = categoryNames[category] || category;

    const prompt = `Gere exatamente ${quantity} mensagens curtas e naturais para WhatsApp na categoria "${categoryDescription}".

Regras importantes:
- Mensagens em português brasileiro informal e natural
- Máximo 40 caracteres cada mensagem
- Devem parecer conversas reais entre amigos
- Podem incluir emojis ocasionalmente (mas não obrigatório)
- Variedade de estilos dentro da categoria
- Nada de aspas ou numeração

Retorne APENAS as mensagens, uma por linha, sem numeração, sem aspas, sem explicações.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você é um assistente que gera mensagens curtas e naturais para conversas de WhatsApp. Responda apenas com as mensagens, uma por linha.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse the response - split by newlines and filter empty lines
    const messages = content
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0 && line.length <= 100)
      .slice(0, quantity);

    console.log('Generated messages:', messages);

    return new Response(
      JSON.stringify({ messages }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating warming content:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
