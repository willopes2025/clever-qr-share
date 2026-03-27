import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const META_API_URL = 'https://graph.facebook.com/v19.0';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Extract user ID from authorization header
    const authHeader = req.headers.get('authorization');
    let senderUserId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      senderUserId = user?.id || null;
    }

    const { conversationId, content, instanceId, messageType, metaTemplate, targetPhone } = await req.json();

    if (!conversationId || (!content && messageType !== 'meta_template')) {
      throw new Error('conversationId and content are required');
    }

    console.log(`[SEND] Sending inbox message for conversation ${conversationId}`);

    // Get conversation with contact info and provider
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        user_id,
        provider,
        meta_phone_number_id,
        instance_id,
        contact:contacts(id, phone, name, label_id)
      `)
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      console.error('[SEND] Conversation fetch error:', convError);
      throw new Error('Failed to fetch conversation');
    }

    const contactData = conversation.contact as unknown as { id: string; phone: string; name: string | null; label_id: string | null } | null;
    if (!contactData || !contactData.phone) {
      throw new Error('Contact not found');
    }

    const isMeta = conversation.provider === 'meta';

    // =========================================
    // META WHATSAPP CLOUD API
    // =========================================
    if (isMeta) {
      console.log('[SEND] Routing to Meta WhatsApp Cloud API');
      
      // Get Meta integration for this user
      const { data: integration } = await supabase
        .from('integrations')
        .select('*')
        .eq('user_id', conversation.user_id)
        .eq('provider', 'meta_whatsapp')
        .eq('is_active', true)
        .maybeSingle();

      if (!integration?.credentials?.access_token) {
        throw new Error('Integração Meta WhatsApp não configurada ou sem access_token');
      }

      // Determine phone_number_id
      let phoneNumberId = conversation.meta_phone_number_id;
      
      if (!phoneNumberId) {
        // Try meta_whatsapp_numbers
        const { data: metaNumber } = await supabase
          .from('meta_whatsapp_numbers')
          .select('phone_number_id')
          .eq('user_id', conversation.user_id)
          .eq('is_active', true)
          .order('connected_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        phoneNumberId = metaNumber?.phone_number_id || integration.credentials?.phone_number_id;
      }

      if (!phoneNumberId) {
        throw new Error('Phone Number ID não encontrado para envio Meta');
      }

      const formattedPhone = (targetPhone || contactData.phone).replace(/[^0-9]/g, '');

      // ---- META TEMPLATE MESSAGE ----
      if (messageType === 'meta_template' && metaTemplate) {
        console.log(`[SEND-META] Sending template "${metaTemplate.name}" to ${formattedPhone}`);

        // Build template components with variable substitution
        const components: any[] = [];
        
        if (metaTemplate.headerType && metaTemplate.headerType !== 'NONE' && metaTemplate.headerType !== 'TEXT') {
          if (metaTemplate.headerContent) {
            const mediaTypeMap: Record<string, string> = { IMAGE: 'image', VIDEO: 'video', DOCUMENT: 'document' };
            const mediaType = mediaTypeMap[metaTemplate.headerType];
            if (mediaType) {
              components.push({
                type: 'header',
                parameters: [{ type: mediaType, [mediaType]: { link: metaTemplate.headerContent } }],
              });
            }
          }
        }

        if (metaTemplate.bodyVariables && metaTemplate.bodyVariables.length > 0) {
          components.push({
            type: 'body',
            parameters: metaTemplate.bodyVariables.map((v: string) => ({ type: 'text', text: v })),
          });
        }

        const messagePayload: any = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedPhone,
          type: 'template',
          template: {
            name: metaTemplate.name,
            language: { code: metaTemplate.language || 'pt_BR' },
          },
        };

        if (components.length > 0) {
          messagePayload.template.components = components;
        }

        // Create message record
        const displayContent = metaTemplate.bodyText || '';
        const { data: message, error: msgError } = await supabase
          .from('inbox_messages')
          .insert({
            conversation_id: conversationId,
            user_id: conversation.user_id,
            direction: 'outbound',
            content: displayContent,
            message_type: 'text',
            status: 'sending',
            sent_at: new Date().toISOString(),
            sent_by_user_id: senderUserId,
          })
          .select()
          .single();

        if (msgError) throw new Error('Failed to create message record');

        const response = await fetch(`${META_API_URL}/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${integration.credentials.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messagePayload),
        });

        const result = await response.json();
        console.log('[SEND-META] Template API response:', JSON.stringify(result));

        if (!response.ok) {
          await supabase.from('inbox_messages').update({ status: 'failed' }).eq('id', message.id);
          throw new Error(result.error?.message || 'Erro ao enviar template via Meta API');
        }

        const whatsappMessageId = result.messages?.[0]?.id;

        await supabase
          .from('inbox_messages')
          .update({ status: 'sent', whatsapp_message_id: whatsappMessageId })
          .eq('id', message.id);

        await supabase
          .from('conversations')
          .update({
            last_message_at: new Date().toISOString(),
            last_message_preview: displayContent.substring(0, 100),
            last_message_direction: 'outbound',
            unread_count: 0,
          })
          .eq('id', conversationId);

        await handleAIHandoff(supabase, conversationId, conversation.user_id, senderUserId, displayContent, instanceId);

        return new Response(
          JSON.stringify({ success: true, message: 'Template sent via Meta', messageId: message.id, whatsappMessageId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ---- REGULAR TEXT MESSAGE ----
      // Create message record first
      const { data: message, error: msgError } = await supabase
        .from('inbox_messages')
        .insert({
          conversation_id: conversationId,
          user_id: conversation.user_id,
          direction: 'outbound',
          content,
          message_type: 'text',
          status: 'sending',
          sent_at: new Date().toISOString(),
          sent_by_user_id: senderUserId,
        })
        .select()
        .single();

      if (msgError) throw new Error('Failed to create message record');

      // Send via Meta API
      const messagePayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedPhone,
        type: 'text',
        text: { body: content },
      };

      console.log(`[SEND-META] Sending to ${formattedPhone} via phone_number_id ${phoneNumberId}`);

      const response = await fetch(`${META_API_URL}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${integration.credentials.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messagePayload),
      });

      const result = await response.json();
      console.log('[SEND-META] API response:', JSON.stringify(result));

      if (!response.ok) {
        await supabase.from('inbox_messages').update({ status: 'failed' }).eq('id', message.id);
        throw new Error(result.error?.message || 'Erro ao enviar via Meta API');
      }

      const whatsappMessageId = result.messages?.[0]?.id;

      // Update message status
      await supabase
        .from('inbox_messages')
        .update({ status: 'sent', whatsapp_message_id: whatsappMessageId })
        .eq('id', message.id);

      // Update conversation
      await supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: content.substring(0, 100),
          last_message_direction: 'outbound',
          unread_count: 0,
        })
        .eq('id', conversationId);

      // Handle AI handoff
      await handleAIHandoff(supabase, conversationId, conversation.user_id, senderUserId, content, instanceId);

      return new Response(
        JSON.stringify({ success: true, message: 'Message sent via Meta', messageId: message.id, whatsappMessageId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================
    // EVOLUTION API (default)
    // =========================================
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!;
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;

    if (!instanceId) {
      throw new Error('instanceId is required for Evolution API');
    }

    // Get instance info
    const { data: instance, error: instError } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_name, evolution_instance_name, status')
      .eq('id', instanceId)
      .single();

    if (instError || !instance) throw new Error('Failed to fetch instance');
    if (instance.status !== 'connected') throw new Error('Instance is not connected');

    // Format phone number — use targetPhone if provided
    const rawPhone = targetPhone || contactData.phone;
    let phone = rawPhone.replace(/\D/g, '');
    let remoteJid: string;
    
    const isLabelIdContact = rawPhone.startsWith('LID_') || (contactData.label_id && phone.length > 13);
    
    if (isLabelIdContact) {
      const labelId = contactData.label_id || phone;
      remoteJid = `${labelId}@lid`;
    } else {
      if (phone.length < 10) throw new Error(`Número inválido: ${rawPhone}`);
      if (!phone.startsWith('55')) phone = '55' + phone;
      if (phone.length < 12 || phone.length > 13) throw new Error('Número inválido: formato incorreto');
      remoteJid = `${phone}@s.whatsapp.net`;
    }

    const evolutionName = instance.evolution_instance_name || instance.instance_name;

    // Create message record
    const { data: message, error: msgError } = await supabase
      .from('inbox_messages')
      .insert({
        conversation_id: conversationId,
        user_id: conversation.user_id,
        direction: 'outbound',
        content,
        message_type: 'text',
        status: 'sending',
        sent_at: new Date().toISOString(),
        sent_by_user_id: senderUserId,
      })
      .select()
      .single();

    if (msgError) throw new Error('Failed to create message record');

    const isLidMessage = remoteJid.endsWith('@lid');
    const sendPayload = isLidMessage 
      ? { number: remoteJid, options: { presence: 'composing' }, text: content }
      : { number: phone, text: content };

    const response = await fetch(
      `${evolutionApiUrl}/message/sendText/${evolutionName}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
        body: JSON.stringify(sendPayload),
      }
    );

    const result = await response.json();

    if (response.ok && result.key) {
      await supabase
        .from('inbox_messages')
        .update({ status: 'sent', whatsapp_message_id: result.key.id })
        .eq('id', message.id);

      await supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: content.substring(0, 100),
          last_message_direction: 'outbound',
          instance_id: instanceId,
          unread_count: 0,
        })
        .eq('id', conversationId);

      await handleAIHandoff(supabase, conversationId, conversation.user_id, senderUserId, content, instanceId);

      return new Response(
        JSON.stringify({ success: true, message: 'Message sent', messageId: message.id, whatsappMessageId: result.key.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      let errorMessage = result.message || result.error || 'Unknown error';
      
      if (response.status === 404 && result.response?.message) {
        const msgDetails = result.response.message;
        if (Array.isArray(msgDetails) && msgDetails.some((m: string) => m.includes('does not exist'))) {
          await supabase.from('whatsapp_instances').update({ status: 'disconnected' }).eq('id', instanceId);
          errorMessage = `Instância "${instance.instance_name}" desconectada. Reconecte nas configurações.`;
        }
      }
      
      if (result.response?.message) {
        const msgDetails = result.response.message;
        if (Array.isArray(msgDetails) && msgDetails.length > 0 && msgDetails[0]?.exists === false) {
          errorMessage = `Número (${phone}) não registrado no WhatsApp.`;
        }
      }
      
      await supabase.from('inbox_messages').update({ status: 'failed' }).eq('id', message.id);
      throw new Error(errorMessage);
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SEND] Error:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper: Handle AI Handoff logic
async function handleAIHandoff(
  supabase: any,
  conversationId: string,
  conversationUserId: string,
  senderUserId: string | null,
  content: string,
  instanceId?: string
) {
  if (!senderUserId) return;

  let pauseEmoji = '🛑';
  let resumeEmoji = '✅';

  if (instanceId) {
    const { data: instanceData } = await supabase
      .from('whatsapp_instances')
      .select('default_funnel_id')
      .eq('id', instanceId)
      .single();

    if (instanceData?.default_funnel_id) {
      const { data: agentConfig } = await supabase
        .from('ai_agent_configs')
        .select('pause_emoji, resume_emoji')
        .eq('funnel_id', instanceData.default_funnel_id)
        .eq('is_active', true)
        .single();
      
      if (agentConfig) {
        pauseEmoji = agentConfig.pause_emoji || pauseEmoji;
        resumeEmoji = agentConfig.resume_emoji || resumeEmoji;
      }
    }
  }

  if (pauseEmoji === '🛑' && resumeEmoji === '✅') {
    const { data: ownerAgent } = await supabase
      .from('ai_agent_configs')
      .select('pause_emoji, resume_emoji')
      .eq('user_id', conversationUserId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (ownerAgent) {
      pauseEmoji = ownerAgent.pause_emoji || pauseEmoji;
      resumeEmoji = ownerAgent.resume_emoji || resumeEmoji;
    }
  }

  const shouldPauseAI = pauseEmoji && content.includes(pauseEmoji);
  const shouldResumeAI = resumeEmoji && content.includes(resumeEmoji);
  const textPatterns = [/\bok\b/i, /\bresumir\s*ia\b/i, /\bativar\s*ia\b/i];
  const hasResumeTextPattern = textPatterns.some(pattern => pattern.test(content));

  if (shouldResumeAI || hasResumeTextPattern) {
    await supabase.from('conversations').update({
      ai_paused: false, ai_handoff_requested: false, ai_handoff_reason: null,
    }).eq('id', conversationId);
  } else if (shouldPauseAI) {
    await supabase.from('conversations').update({
      ai_paused: true, ai_handoff_requested: true,
      ai_handoff_reason: `Pausado via emoji ${pauseEmoji}`,
    }).eq('id', conversationId);
  } else {
    await supabase.from('conversations').update({
      ai_paused: true, ai_handoff_requested: true,
      ai_handoff_reason: 'Atendente assumiu a conversa',
    }).eq('id', conversationId);
  }
}
