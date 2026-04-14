import { createClient } from "npm:@supabase/supabase-js@2";
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const { ai_prompt, contact_id, conversation_id } = await req.json();

    if (!ai_prompt || !contact_id) {
      throw new Error('ai_prompt and contact_id are required');
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) throw new Error('LOVABLE_API_KEY not configured');

    // Fetch contact
    const { data: contact } = await supabase
      .from('contacts')
      .select('name, phone, email, custom_fields')
      .eq('id', contact_id)
      .single();

    if (!contact) throw new Error('Contact not found');

    // Fetch conversation history
    let messagesContext = '';
    if (conversation_id) {
      const { data: messages } = await supabase
        .from('inbox_messages')
        .select('content, direction, created_at')
        .eq('conversation_id', conversation_id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (messages && messages.length > 0) {
        const reversed = messages.reverse();
        messagesContext = '\nÚltimas mensagens:\n' + reversed.map((m: any) => {
          const dir = m.direction === 'outbound' ? 'Você' : (contact.name || 'Contato');
          return `${dir}: ${m.content || '[mídia]'}`;
        }).join('\n');
      }
    }

    // Fetch deal data
    let dealContext = '';
    const { data: deals } = await supabase
      .from('funnel_deals')
      .select('value, custom_fields, stage:funnel_stages(name)')
      .eq('contact_id', contact_id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (deals && deals.length > 0) {
      const deal = deals[0];
      dealContext = `\nEtapa do funil: ${(deal.stage as any)?.name || 'N/A'}`;
      if (deal.value) dealContext += `\nValor: R$ ${deal.value}`;
    }

    const contactContext = `Contato: ${contact.name || 'Sem nome'}
Telefone: ${contact.phone}
${contact.email ? `Email: ${contact.email}` : ''}${dealContext}${messagesContext}`;

    const systemPrompt = `Você é um assistente que gera mensagens de WhatsApp personalizadas.
Gere UMA mensagem única e personalizada seguindo as instruções do usuário.
A mensagem deve ser natural, direta e pronta para envio.
Use SOMENTE os dados realmente presentes no contexto do contato.
Se um dado não existir no contexto, não invente e não mencione.
Retorne APENAS a mensagem, sem aspas, sem explicações.`;

    const userMessage = `Instrução do template:\n${ai_prompt}\n\nContexto do contato:\n${contactContext}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.8,
      })
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI error:', aiResponse.status, errText);
      throw new Error(`AI generation failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const generatedMessage = aiData.choices?.[0]?.message?.content?.trim();

    if (!generatedMessage) {
      throw new Error('No message generated');
    }

    return new Response(
      JSON.stringify({ message: generatedMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
