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
      if (response.status >= 500 && response.status <= 599 && attempt < maxAttempts) {
        const bodyPreview = await response.clone().text().catch(() => '');
        lastTransientError = `HTTP ${response.status}: ${bodyPreview.slice(0, 200)}`;
        console.warn(`[SEND-MEDIA] Transient error attempt ${attempt}: ${lastTransientError}`);
        await new Promise((r) => setTimeout(r, backoffMs[attempt - 1]));
        continue;
      }
      return { response, attempts: attempt, lastTransientError };
    } catch (err) {
      lastTransientError = err instanceof Error ? err.message : String(err);
      console.warn(`[SEND-MEDIA] Network error attempt ${attempt}: ${lastTransientError}`);
      if (attempt >= maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, backoffMs[attempt - 1]));
    }
  }
  throw new Error(lastTransientError || 'fetchWithRetry failed');
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

    const { conversationId, mediaUrl, mediaType, caption, instanceId, targetPhone } = await req.json();

    if (!conversationId || !mediaUrl || !mediaType || !instanceId) {
      throw new Error('conversationId, mediaUrl, mediaType and instanceId are required');
    }

    console.log(`Sending ${mediaType} to conversation ${conversationId} via instance ${instanceId}`);

    // Get conversation with contact info
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        user_id,
        provider,
        meta_phone_number_id,
        instance_id,
        contact:contacts(id, phone, name)
      `)
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      console.error('Conversation fetch error:', convError);
      throw new Error('Failed to fetch conversation');
    }

    // Type-safe access to contact
    const contactData = conversation.contact as unknown as { id: string; phone: string; name: string | null } | null;
    if (!contactData || !contactData.phone) {
      throw new Error('Contact not found');
    }

    // Check if user chose an Evolution instance for a Meta conversation
    let forceEvolution = false;
    if (instanceId && conversation.provider === 'meta') {
      const { data: evoInstance } = await supabase
        .from('whatsapp_instances')
        .select('id')
        .eq('id', instanceId)
        .maybeSingle();
      if (evoInstance) {
        forceEvolution = true;
        console.log(`[SEND-MEDIA] Meta conversation but user chose Evolution instance ${instanceId} — routing to Evolution API`);
      }
    }

    const isMeta = conversation.provider === 'meta' && !forceEvolution;

    // =========================================
    // META WHATSAPP CLOUD API
    // =========================================
    if (isMeta) {
      console.log('[SEND-MEDIA] Routing to Meta WhatsApp Cloud API');

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

      // Determine phone_number_id - use instanceId which is the meta_phone_number_id from frontend
      let phoneNumberId = instanceId || conversation.meta_phone_number_id;

      if (!phoneNumberId) {
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

      // Create message record
      const { data: message, error: msgError } = await supabase
        .from('inbox_messages')
        .insert({
          conversation_id: conversationId,
          user_id: conversation.user_id,
          direction: 'outbound',
          content: caption || '',
          message_type: mediaType,
          media_url: mediaUrl,
          status: 'sending',
          sent_at: new Date().toISOString(),
          sent_by_user_id: senderUserId,
          sent_via_meta_number_id: phoneNumberId,
        })
        .select()
        .single();

      if (msgError) {
        console.error('Message insert error:', msgError);
        throw new Error('Failed to create message record');
      }

      // Build Meta API payload for media
      let messagePayload: Record<string, unknown>;

      if (mediaType === 'image') {
        messagePayload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedPhone,
          type: 'image',
          image: { link: mediaUrl, caption: caption || undefined },
        };
      } else if (mediaType === 'video') {
        messagePayload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedPhone,
          type: 'video',
          video: { link: mediaUrl, caption: caption || undefined },
        };
      } else if (mediaType === 'audio') {
        messagePayload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedPhone,
          type: 'audio',
          audio: { link: mediaUrl },
        };
      } else {
        // document
        messagePayload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedPhone,
          type: 'document',
          document: { link: mediaUrl, caption: caption || undefined, filename: caption || 'document' },
        };
      }

      console.log(`[SEND-MEDIA-META] Sending ${mediaType} to ${formattedPhone} via phone_number_id ${phoneNumberId}`);

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
      console.log('[SEND-MEDIA-META] API response:', JSON.stringify(result));

      if (!response.ok) {
        const failReason = result.error?.message || 'Erro ao enviar mídia via Meta API';
        await supabase.from('inbox_messages').update({ status: 'failed', error_message: failReason }).eq('id', message.id);
        throw new Error(failReason);
      }

      const whatsappMessageId = result.messages?.[0]?.id;

      await supabase
        .from('inbox_messages')
        .update({ status: 'sent', whatsapp_message_id: whatsappMessageId })
        .eq('id', message.id);

      // Update conversation
      const previewText = caption || `[${mediaType === 'image' ? 'Imagem' : mediaType === 'audio' ? 'Áudio' : mediaType === 'video' ? 'Vídeo' : 'Documento'}]`;

      await supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: previewText.substring(0, 100),
          last_message_direction: 'outbound',
        })
        .eq('id', conversationId);

      // Handle AI handoff
      if (senderUserId) {
        await supabase
          .from('conversations')
          .update({
            ai_paused: true,
            ai_handoff_requested: true,
            ai_handoff_reason: 'Atendente assumiu a conversa',
          })
          .eq('id', conversationId);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Media sent via Meta', messageId: message.id, whatsappMessageId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================
    // EVOLUTION API (WhatsApp Lite)
    // =========================================
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!;
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;

    // Get instance info
    const { data: instance, error: instError } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_name, evolution_instance_name, status')
      .eq('id', instanceId)
      .single();

    if (instError || !instance) {
      console.error('Instance fetch error:', instError);
      throw new Error('Failed to fetch instance');
    }

    if (instance.status !== 'connected') {
      throw new Error('Instance is not connected');
    }
    
    // Format phone number - handle LID contacts (Click-to-WhatsApp Ads)
    const rawPhone = targetPhone || contactData.phone;
    let phone: string;
    const isLidContact = rawPhone.startsWith('LID_');
    
    if (isLidContact) {
      const labelId = rawPhone.replace('LID_', '');
      phone = `${labelId}@lid`;
      console.log(`[LID] Using LID format for contact: ${phone}`);
    } else {
      phone = rawPhone.replace(/\D/g, '');
      
      if (phone.length > 13 || phone.length < 10) {
        throw new Error(`Número de telefone inválido: ${rawPhone}`);
      }
      
      if (!phone.startsWith('55')) {
        phone = '55' + phone;
      }
    }

    // Create message record first
    const { data: message, error: msgError } = await supabase
      .from('inbox_messages')
      .insert({
        conversation_id: conversationId,
        user_id: conversation.user_id,
        direction: 'outbound',
        content: caption || '',
        message_type: mediaType,
        media_url: mediaUrl,
        status: 'sending',
        sent_at: new Date().toISOString(),
        sent_by_user_id: senderUserId,
        sent_via_instance_id: instanceId,
      })
      .select()
      .single();
    
    console.log(`Media message created with sent_by_user_id: ${senderUserId}`);

    if (msgError) {
      console.error('Message insert error:', msgError);
      throw new Error('Failed to create message record');
    }

    // Determine Evolution API endpoint based on media type
    let endpoint: string;
    let body: Record<string, unknown>;

    const instanceNameForApi = (instance.evolution_instance_name || instance.instance_name).trim();
    const encodedInstanceName = encodeURIComponent(instanceNameForApi);

    switch (mediaType) {
      case 'image':
        endpoint = `${evolutionApiUrl}/message/sendMedia/${encodedInstanceName}`;
        body = {
          number: phone,
          mediatype: 'image',
          media: mediaUrl,
          caption: caption || '',
        };
        break;

      case 'audio':
      case 'voice':
        endpoint = `${evolutionApiUrl}/message/sendWhatsAppAudio/${encodedInstanceName}`;
        body = {
          number: phone,
          audio: mediaUrl,
        };
        break;

      case 'video':
        endpoint = `${evolutionApiUrl}/message/sendMedia/${encodedInstanceName}`;
        body = {
          number: phone,
          mediatype: 'video',
          media: mediaUrl,
          caption: caption || '',
        };
        break;

      case 'document':
      default:
        endpoint = `${evolutionApiUrl}/message/sendMedia/${encodedInstanceName}`;
        body = {
          number: phone,
          mediatype: 'document',
          media: mediaUrl,
          caption: caption || '',
          fileName: caption || 'document',
        };
        break;
    }

    console.log(`Using instance name for Evolution API: ${instanceNameForApi}`);
    console.log(`Calling Evolution API: ${endpoint}`);
    console.log('Body:', JSON.stringify(body));

    // Send via Evolution API (with retry on transient 5xx)
    const { response, attempts, lastTransientError } = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey
      },
      body: JSON.stringify(body)
    });

    let result: any;
    let rawText: string | undefined;
    try {
      result = await response.json();
    } catch {
      rawText = await response.text().catch(() => `HTTP ${response.status}`);
      result = { error: rawText || `HTTP ${response.status}` };
    }
    console.log('Evolution API response:', JSON.stringify(result), `attempts=${attempts}`);

    if (response.ok && result.key) {
      // Success
      await supabase
        .from('inbox_messages')
        .update({ 
          status: 'sent',
          whatsapp_message_id: result.key.id
        })
        .eq('id', message.id);

      // Update conversation
      const previewText = caption || `[${mediaType === 'image' ? 'Imagem' : mediaType === 'audio' ? 'Áudio' : mediaType === 'video' ? 'Vídeo' : 'Documento'}]`;
      
      await supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: previewText.substring(0, 100),
          last_message_direction: 'outbound',
          instance_id: instanceId,
        })
        .eq('id', conversationId);

      // Handle AI handoff logic when human agent sends media
      if (senderUserId) {
        const captionToCheck = caption || '';
        const okPatterns = ['👍', '✅', '🤖'];
        const textPatterns = [/\bok\b/i, /\bresumir\s*ia\b/i, /\bativar\s*ia\b/i];
        
        const shouldResumeAI = okPatterns.some(emoji => captionToCheck.includes(emoji)) ||
                               textPatterns.some(pattern => pattern.test(captionToCheck));

        if (shouldResumeAI) {
          await supabase
            .from('conversations')
            .update({
              ai_paused: false,
              ai_handoff_requested: false,
              ai_handoff_reason: null,
            })
            .eq('id', conversationId);
          
          console.log(`[HANDOFF] AI resumed via media caption for conversation ${conversationId}`);
        } else {
          await supabase
            .from('conversations')
            .update({
              ai_paused: true,
              ai_handoff_requested: true,
              ai_handoff_reason: 'Atendente assumiu a conversa',
            })
            .eq('id', conversationId);
          
          console.log(`[HANDOFF] AI paused - human (${senderUserId}) sent media to conversation ${conversationId}`);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Media sent successfully',
          messageId: message.id,
          whatsappMessageId: result.key.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Failed
      const errorMessage = result.message || result.error || 'Unknown error';
      
      await supabase
        .from('inbox_messages')
        .update({ status: 'failed', error_message: errorMessage })
        .eq('id', message.id);
      
      throw new Error(errorMessage);
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in send-inbox-media:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
