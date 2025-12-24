import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface CampaignAIConfig {
  ai_enabled: boolean;
  ai_prompt: string | null;
  ai_knowledge_base: string | null;
  ai_max_interactions: number;
  ai_response_delay_min: number;
  ai_response_delay_max: number;
  ai_handoff_keywords: string[];
  ai_active_hours_start: number;
  ai_active_hours_end: number;
}

// Check if current time is within allowed AI hours
const isWithinActiveHours = (startHour: number, endHour: number): boolean => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    hour12: false,
  });
  const currentHour = parseInt(formatter.format(now));
  return currentHour >= startHour && currentHour < endHour;
};

// Check if message contains handoff keywords
const containsHandoffKeyword = (message: string, keywords: string[]): boolean => {
  const lowerMessage = message.toLowerCase();
  return keywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()));
};

// Get random delay for response
const getRandomDelay = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!;
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { conversationId, messageContent, instanceName } = await req.json();

    if (!conversationId || !messageContent) {
      throw new Error('conversationId and messageContent are required');
    }

    console.log(`[AI-AGENT] Processing message for conversation ${conversationId}`);

    // Fetch conversation with campaign info
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id, user_id, contact_id, campaign_id, ai_handled, ai_interactions_count, ai_paused, ai_handoff_requested,
        contacts!inner(id, phone, name),
        campaigns(
          id, name, ai_enabled, ai_prompt, ai_knowledge_base, ai_max_interactions,
          ai_response_delay_min, ai_response_delay_max, ai_handoff_keywords,
          ai_active_hours_start, ai_active_hours_end
        )
      `)
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      console.error('[AI-AGENT] Conversation not found:', convError);
      return new Response(
        JSON.stringify({ success: false, error: 'Conversation not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if AI should respond
    // deno-lint-ignore no-explicit-any
    const campaigns = conversation.campaigns as any;
    const campaign = Array.isArray(campaigns) ? campaigns[0] : campaigns;
    
    if (!campaign || !campaign.ai_enabled) {
      console.log('[AI-AGENT] AI not enabled for this campaign');
      return new Response(
        JSON.stringify({ success: false, reason: 'AI not enabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (conversation.ai_paused) {
      console.log('[AI-AGENT] AI is paused for this conversation');
      return new Response(
        JSON.stringify({ success: false, reason: 'AI paused' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (conversation.ai_handoff_requested) {
      console.log('[AI-AGENT] Handoff already requested');
      return new Response(
        JSON.stringify({ success: false, reason: 'Handoff requested' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if within active hours
    if (!isWithinActiveHours(campaign.ai_active_hours_start, campaign.ai_active_hours_end)) {
      console.log('[AI-AGENT] Outside active hours');
      return new Response(
        JSON.stringify({ success: false, reason: 'Outside active hours' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check max interactions
    const interactionCount = conversation.ai_interactions_count || 0;
    if (interactionCount >= campaign.ai_max_interactions) {
      console.log('[AI-AGENT] Max interactions reached, triggering handoff');
      
      await supabase
        .from('conversations')
        .update({
          ai_handoff_requested: true,
          ai_handoff_reason: 'Limite de interações atingido',
        })
        .eq('id', conversationId);

      return new Response(
        JSON.stringify({ success: false, reason: 'Max interactions reached', handoff: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for handoff keywords
    const handoffKeywords = campaign.ai_handoff_keywords || ['atendente', 'humano', 'pessoa', 'falar com alguém'];
    if (containsHandoffKeyword(messageContent, handoffKeywords)) {
      console.log('[AI-AGENT] Handoff keyword detected');
      
      await supabase
        .from('conversations')
        .update({
          ai_handoff_requested: true,
          ai_handoff_reason: `Cliente solicitou atendimento humano`,
        })
        .eq('id', conversationId);

      // Send handoff message
      const handoffMessage = 'Entendi! Vou transferir você para um de nossos atendentes. Aguarde um momento, por favor.';
      
      // deno-lint-ignore no-explicit-any
      const contactsHandoff = conversation.contacts as any;
      const contactHandoff = Array.isArray(contactsHandoff) ? contactsHandoff[0] : contactsHandoff;
      let phone = (contactHandoff?.phone || '').replace(/\D/g, '');
      if (!phone.startsWith('55')) phone = '55' + phone;

      await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey,
        },
        body: JSON.stringify({ number: phone, text: handoffMessage }),
      });

      return new Response(
        JSON.stringify({ success: true, handoff: true, message: handoffMessage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch conversation history for context
    const { data: messages } = await supabase
      .from('inbox_messages')
      .select('content, direction, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(20);

    // Build conversation history for AI
    const conversationHistory: ConversationMessage[] = (messages || []).map(msg => ({
      role: msg.direction === 'inbound' ? 'user' : 'assistant',
      content: msg.content,
    }));

    // Add current message
    conversationHistory.push({ role: 'user', content: messageContent });

    // Build system prompt
    // deno-lint-ignore no-explicit-any
    const contacts = conversation.contacts as any;
    const contact = Array.isArray(contacts) ? contacts[0] : contacts;
    const contactName = contact?.name || 'Cliente';
    
    let systemPrompt = campaign.ai_prompt || 
      'Você é um assistente virtual amigável e profissional. Responda de forma clara e concisa.';
    
    // Add knowledge base if available
    if (campaign.ai_knowledge_base) {
      systemPrompt += `\n\nBase de conhecimento:\n${campaign.ai_knowledge_base}`;
    }
    
    // Add context
    systemPrompt += `\n\nContexto:
- Nome do cliente: ${contactName}
- Esta é uma conversa via WhatsApp
- Seja educado, amigável e objetivo
- Use linguagem informal mas profissional
- Se não souber responder algo específico, sugira falar com um atendente
- Não invente informações que não estão na base de conhecimento`;

    console.log('[AI-AGENT] Calling Lovable AI...');

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
          ...conversationHistory,
        ],
        max_tokens: 500,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[AI-AGENT] AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiMessage = aiData.choices?.[0]?.message?.content;

    if (!aiMessage) {
      console.error('[AI-AGENT] No AI response content');
      throw new Error('No AI response');
    }

    console.log('[AI-AGENT] AI response:', aiMessage.substring(0, 100));

    // Apply response delay
    const delay = getRandomDelay(campaign.ai_response_delay_min, campaign.ai_response_delay_max);
    console.log(`[AI-AGENT] Waiting ${delay}s before sending...`);
    await new Promise(resolve => setTimeout(resolve, delay * 1000));

    // Send response via Evolution API
    // deno-lint-ignore no-explicit-any
    const contactsForPhone = conversation.contacts as any;
    const contactData = Array.isArray(contactsForPhone) ? contactsForPhone[0] : contactsForPhone;
    let phone = (contactData?.phone || '').replace(/\D/g, '');
    if (!phone.startsWith('55')) phone = '55' + phone;

    const sendResponse = await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey,
      },
      body: JSON.stringify({ number: phone, text: aiMessage }),
    });

    const sendResult = await sendResponse.json();
    console.log('[AI-AGENT] Evolution API response:', sendResult);

    if (!sendResponse.ok || !sendResult.key) {
      console.error('[AI-AGENT] Failed to send message');
      throw new Error('Failed to send message via Evolution API');
    }

    // Update conversation AI counters
    await supabase
      .from('conversations')
      .update({
        ai_handled: true,
        ai_interactions_count: interactionCount + 1,
      })
      .eq('id', conversationId);

    // Save AI message to inbox
    await supabase
      .from('inbox_messages')
      .insert({
        user_id: conversation.user_id,
        conversation_id: conversationId,
        content: aiMessage,
        direction: 'outbound',
        status: 'sent',
        message_type: 'text',
        whatsapp_message_id: sendResult.key?.id || null,
        sent_at: new Date().toISOString(),
      });

    // Update conversation last message
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: aiMessage.substring(0, 100),
      })
      .eq('id', conversationId);

    console.log('[AI-AGENT] Message sent successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: aiMessage,
        interactionCount: interactionCount + 1,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[AI-AGENT] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
