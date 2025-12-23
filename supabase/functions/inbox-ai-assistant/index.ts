import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Message {
  content: string;
  direction: string;
  created_at: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { conversationId, action, customPrompt, tone, originalMessage } = await req.json();

    if (!conversationId || !action) {
      throw new Error('conversationId and action are required');
    }

    console.log(`AI Assistant: ${action} for conversation ${conversationId}`, { tone, hasOriginalMessage: !!originalMessage });

    // Get conversation with contact info
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        contact:contacts(name, phone)
      `)
      .eq('id', conversationId)
      .single();

    if (convError) {
      throw new Error('Failed to fetch conversation');
    }

    // Get recent messages
    const { data: messages, error: msgError } = await supabase
      .from('inbox_messages')
      .select('content, direction, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (msgError) {
      throw new Error('Failed to fetch messages');
    }

    // Prepare conversation history for AI
    const contactData = conversation.contact as unknown as { name: string | null; phone: string } | null;
    const contactName = contactData?.name || contactData?.phone || 'Cliente';
    
    const conversationHistory = (messages as Message[] || [])
      .reverse()
      .map((m: Message) => `${m.direction === 'inbound' ? contactName : 'Você'}: ${m.content}`)
      .join('\n');

    // Determine system prompt based on action
    let systemPrompt: string;
    let userPrompt: string;

    switch (action) {
      case 'suggest':
        systemPrompt = `Você é um assistente de atendimento ao cliente profissional e empático. 
Analise a conversa abaixo e sugira 3 respostas curtas e adequadas que o atendente pode enviar.
Retorne APENAS as 3 sugestões, uma por linha, numeradas (1., 2., 3.).
Seja conciso, profissional e amigável.`;
        userPrompt = `Conversa com ${contactName}:\n\n${conversationHistory}\n\nSugira 3 respostas apropriadas:`;
        break;

      case 'respond':
        systemPrompt = `Você é um assistente de atendimento ao cliente profissional e empático.
Analise a conversa e gere UMA resposta completa e adequada para enviar ao cliente.
A resposta deve ser natural, profissional e resolver a necessidade do cliente.
Retorne APENAS a resposta, sem explicações.`;
        userPrompt = `Conversa com ${contactName}:\n\n${conversationHistory}\n\nGere uma resposta apropriada:`;
        break;

      case 'summarize':
        systemPrompt = `Você é um assistente de análise de conversas.
Analise a conversa abaixo e forneça um resumo conciso incluindo:
- Assunto principal da conversa
- Necessidades ou problemas do cliente
- Status atual (resolvido, pendente, aguardando resposta)
- Próximos passos sugeridos

Seja objetivo e conciso.`;
        userPrompt = `Conversa com ${contactName}:\n\n${conversationHistory}\n\nResuma esta conversa:`;
        break;

      case 'translate':
        systemPrompt = `Você é um tradutor profissional.
Traduza a última mensagem do cliente para português brasileiro.
Se já estiver em português, traduza para inglês.
Retorne APENAS a tradução, sem explicações.`;
        const lastInbound = (messages as Message[]).find((m: Message) => m.direction === 'inbound');
        userPrompt = lastInbound 
          ? `Traduza: "${lastInbound.content}"`
          : 'Não há mensagens do cliente para traduzir.';
        break;

      case 'custom':
        systemPrompt = `Você é um assistente de atendimento ao cliente inteligente.
Siga as instruções do usuário para ajudar com a conversa.`;
        userPrompt = `Conversa com ${contactName}:\n\n${conversationHistory}\n\nInstrução: ${customPrompt || 'Ajude com esta conversa'}`;
        break;

      case 'rewrite':
        const toneDescriptions: Record<string, string> = {
          'formal': 'profissional, corporativo e direto. Use linguagem formal e evite gírias.',
          'friendly': 'amigável, casual e simpático. Use linguagem leve e acolhedora, pode incluir emojis moderadamente.',
          'welcoming': 'acolhedora, empática e calorosa. Demonstre compreensão e cuidado genuíno.',
          'correction': 'APENAS faça correções ortográficas e gramaticais. NÃO mude o tom, estilo ou sentido da mensagem.'
        };
        
        const toneDescription = toneDescriptions[tone || 'formal'] || toneDescriptions['formal'];
        
        if (tone === 'correction') {
          systemPrompt = `Você é um corretor ortográfico e gramatical profissional.
Corrija APENAS erros de ortografia, gramática e pontuação da mensagem.
NÃO altere o tom, estilo, palavras ou sentido da mensagem.
Retorne APENAS a mensagem corrigida, sem explicações ou comentários.`;
        } else {
          systemPrompt = `Você é um assistente de escrita profissional especializado em comunicação empresarial.
Reescreva a mensagem abaixo em tom ${toneDescription}
Mantenha o significado e a intenção original da mensagem.
Retorne APENAS a mensagem reescrita, sem explicações, comentários ou aspas.`;
        }
        
        userPrompt = `Mensagem original: "${originalMessage}"`;
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Call Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
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

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error('Limite de requisições excedido. Tente novamente em alguns segundos.');
      }
      if (aiResponse.status === 402) {
        throw new Error('Créditos esgotados. Por favor, adicione créditos à sua conta.');
      }
      
      throw new Error('Erro ao processar com IA');
    }

    const data = await aiResponse.json();
    const result = data.choices?.[0]?.message?.content || 'Não foi possível gerar uma resposta.';

    console.log('AI result:', result);

    return new Response(
      JSON.stringify({ success: true, result, action }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in inbox-ai-assistant:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
