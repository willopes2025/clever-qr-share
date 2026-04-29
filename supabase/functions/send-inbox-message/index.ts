import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const META_API_URL = 'https://graph.facebook.com/v19.0';

// Retry helper for transient Evolution API failures (5xx / network errors)
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxAttempts = 3,
): Promise<{ response: Response; attempts: number; lastTransientError?: string }> {
  const backoffMs = [500, 1500, 3000];
  let lastTransientError: string | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, init);
      // Retry only on transient server errors
      if (response.status >= 500 && response.status <= 599 && attempt < maxAttempts) {
        const bodyPreview = await response.clone().text().catch(() => '');
        lastTransientError = `HTTP ${response.status}: ${bodyPreview.slice(0, 200)}`;
        console.warn(`[SEND] Transient error on attempt ${attempt}: ${lastTransientError}. Retrying in ${backoffMs[attempt - 1]}ms...`);
        await new Promise((r) => setTimeout(r, backoffMs[attempt - 1]));
        continue;
      }
      return { response, attempts: attempt, lastTransientError };
    } catch (err) {
      lastTransientError = err instanceof Error ? err.message : String(err);
      console.warn(`[SEND] Network error on attempt ${attempt}: ${lastTransientError}`);
      if (attempt >= maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, backoffMs[attempt - 1]));
    }
  }
  // unreachable
  throw new Error(lastTransientError || 'fetchWithRetry failed');
}

async function getOrganizationMemberIds(supabase: any, userId: string): Promise<string[]> {
  try {
    const { data } = await supabase.rpc('get_organization_member_ids', { _user_id: userId });
    const ids = (data || [])
      .map((row: string | { get_organization_member_ids?: string }) => typeof row === 'string' ? row : row?.get_organization_member_ids)
      .filter(Boolean);

    return ids.length ? Array.from(new Set(ids)) : [userId];
  } catch (error) {
    console.error('[SEND] Error fetching organization members:', error);
    return [userId];
  }
}

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

    const { conversationId, content, instanceId, messageType, metaTemplate, targetPhone, action, messageId, emoji } = await req.json();

    // =========================================
    // REACTION ACTION
    // =========================================
    if (action === 'reaction' && messageId && emoji !== undefined) {
      console.log(`[SEND] Sending reaction "${emoji}" to message ${messageId} in conversation ${conversationId}`);
      
      // Get the message to react to
      const { data: targetMessage, error: msgErr } = await supabase
        .from('inbox_messages')
        .select('id, conversation_id, whatsapp_message_id, sent_via_instance_id, sent_via_meta_number_id')
        .eq('id', messageId)
        .single();
      
      if (msgErr || !targetMessage) throw new Error('Message not found');
      
      // Get conversation info
      const { data: conv } = await supabase
        .from('conversations')
        .select('id, user_id, provider, meta_phone_number_id, instance_id, contact:contacts(id, phone, label_id)')
        .eq('id', conversationId)
        .single();
      
      if (!conv) throw new Error('Conversation not found');
      
      const contactInfo = conv.contact as unknown as { id: string; phone: string; label_id: string | null } | null;
      if (!contactInfo) throw new Error('Contact not found');

      const whatsappMsgId = targetMessage.whatsapp_message_id;
      
      // Determine provider
      const effectiveInstanceId = instanceId || conv.instance_id;
      const isMeta = conv.provider === 'meta' && !effectiveInstanceId;
      
      if (isMeta && whatsappMsgId) {
        // Send reaction via Meta Cloud API
        const { data: integration } = await supabase
          .from('integrations')
          .select('*')
          .eq('user_id', conv.user_id)
          .eq('provider', 'meta_whatsapp')
          .eq('is_active', true)
          .maybeSingle();
        
        if (integration?.credentials?.access_token) {
          const phoneNumberId = conv.meta_phone_number_id || integration.credentials?.phone_number_id;
          const formattedPhone = contactInfo.phone.replace(/[^0-9]/g, '');
          
          await fetch(`${META_API_URL}/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${integration.credentials.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: formattedPhone,
              type: 'reaction',
              reaction: { message_id: whatsappMsgId, emoji: emoji || '' },
            }),
          });
        }
      } else if (effectiveInstanceId && whatsappMsgId) {
        // Send reaction via Evolution API
        const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!;
        const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;
        
        const { data: instance } = await supabase
          .from('whatsapp_instances')
          .select('evolution_instance_name, instance_name')
          .eq('id', effectiveInstanceId)
          .single();
        
        if (instance) {
          const evolutionName = instance.evolution_instance_name || instance.instance_name;
          let phone = contactInfo.phone.replace(/\D/g, '');
          const isLid = contactInfo.label_id && phone.length > 13;
          const remoteJid = isLid ? `${contactInfo.label_id}@lid` : `${phone}@s.whatsapp.net`;
          
          await fetch(`${evolutionApiUrl}/message/sendReaction/${evolutionName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
            body: JSON.stringify({
              key: { remoteJid, fromMe: targetMessage.sent_via_instance_id ? true : false, id: whatsappMsgId },
              reaction: emoji || '',
            }),
          });
        }
      }
      
      // Save/remove reaction in DB
      if (emoji === '' || emoji === null) {
        await supabase
          .from('message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('reacted_by', senderUserId || 'user');
      } else {
        // Remove existing reaction from this user, then insert
        await supabase
          .from('message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('reacted_by', senderUserId || 'user');
        
        await supabase
          .from('message_reactions')
          .insert({
            message_id: messageId,
            conversation_id: conversationId,
            emoji,
            reacted_by: senderUserId || 'user',
          });
      }
      
      return new Response(
        JSON.stringify({ success: true, action: 'reaction' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Check if the user explicitly chose an Evolution instance for this send
    // (even if the conversation provider is 'meta', the user may switch sender)
    let forceEvolution = false;
    if (instanceId && conversation.provider === 'meta') {
      const { data: evoInstance } = await supabase
        .from('whatsapp_instances')
        .select('id')
        .eq('id', instanceId)
        .maybeSingle();
      if (evoInstance) {
        forceEvolution = true;
        console.log(`[SEND] Meta conversation but user chose Evolution instance ${instanceId} — routing to Evolution API`);
      }
    }

    const isMeta = conversation.provider === 'meta' && !forceEvolution;

    // =========================================
    // META WHATSAPP CLOUD API
    // =========================================
    if (isMeta) {
      console.log('[SEND] Routing to Meta WhatsApp Cloud API');
      
      // Get Meta integration for this conversation owner or another active org member
      let { data: integration } = await supabase
        .from('integrations')
        .select('*')
        .eq('user_id', conversation.user_id)
        .eq('provider', 'meta_whatsapp')
        .eq('is_active', true)
        .maybeSingle();

      if (!integration?.credentials?.access_token) {
        const organizationMemberIds = await getOrganizationMemberIds(supabase, conversation.user_id);

        if (conversation.meta_phone_number_id) {
          const { data: metaNumberOwner } = await supabase
            .from('meta_whatsapp_numbers')
            .select('user_id')
            .in('user_id', organizationMemberIds)
            .eq('phone_number_id', conversation.meta_phone_number_id)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();

          if (metaNumberOwner?.user_id) {
            const { data: orgIntegration } = await supabase
              .from('integrations')
              .select('*')
              .eq('user_id', metaNumberOwner.user_id)
              .eq('provider', 'meta_whatsapp')
              .eq('is_active', true)
              .maybeSingle();

            integration = orgIntegration;
          }
        }

        if (!integration?.credentials?.access_token) {
          const { data: fallbackIntegration } = await supabase
            .from('integrations')
            .select('*')
            .in('user_id', organizationMemberIds)
            .eq('provider', 'meta_whatsapp')
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();

          integration = fallbackIntegration;
        }
      }

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
            sent_via_meta_number_id: phoneNumberId,
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

        let result: any;
        try {
          result = await response.json();
        } catch {
          const text = await response.text().catch(() => `HTTP ${response.status}`);
          result = { error: { message: text || `HTTP ${response.status}` } };
        }
        console.log('[SEND-META] Template API response:', JSON.stringify(result));

        if (!response.ok) {
          const failReason = result.error?.message || 'Erro ao enviar template via Meta API';
          await supabase.from('inbox_messages').update({ status: 'failed', error_message: failReason }).eq('id', message.id);
          throw new Error(failReason);
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
          sent_via_meta_number_id: phoneNumberId,
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

      let result: any;
      try {
        result = await response.json();
      } catch {
        const text = await response.text().catch(() => `HTTP ${response.status}`);
        result = { error: { message: text || `HTTP ${response.status}` } };
      }
      console.log('[SEND-META] API response:', JSON.stringify(result));

      if (!response.ok) {
        const failReason = result.error?.message || 'Erro ao enviar via Meta API';
        await supabase.from('inbox_messages').update({ status: 'failed', error_message: failReason }).eq('id', message.id);
        throw new Error(failReason);
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
        sent_via_instance_id: instanceId,
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

    let result: any;
    try {
      result = await response.json();
    } catch {
      const text = await response.text().catch(() => `HTTP ${response.status}`);
      result = { error: text || `HTTP ${response.status}` };
    }

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
      
      await supabase.from('inbox_messages').update({ status: 'failed', error_message: errorMessage }).eq('id', message.id);
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
