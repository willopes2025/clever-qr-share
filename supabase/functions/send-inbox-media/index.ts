import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!;
  const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;

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

    const { conversationId, mediaUrl, mediaType, caption, instanceId } = await req.json();

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
        contact:contacts(id, phone, name)
      `)
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      console.error('Conversation fetch error:', convError);
      throw new Error('Failed to fetch conversation');
    }

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

    // Type-safe access to contact
    const contactData = conversation.contact as unknown as { id: string; phone: string; name: string | null } | null;
    if (!contactData || !contactData.phone) {
      throw new Error('Contact not found');
    }
    
    // Format phone number
    let phone = contactData.phone.replace(/\D/g, '');
    
    // Validate phone
    if (phone.length > 13 || phone.length < 10) {
      throw new Error(`Número de telefone inválido: ${contactData.phone}`);
    }
    
    // Add Brazil country code if missing
    if (!phone.startsWith('55')) {
      phone = '55' + phone;
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

    // Prefer the Evolution instance name when available (UI name can differ)
    const instanceNameForApi = (instance.evolution_instance_name || instance.instance_name).trim();

    // Encode instance name for URL (handles spaces and special characters)
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

    // Send via Evolution API
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey
      },
      body: JSON.stringify(body)
    });

    const result = await response.json();
    console.log('Evolution API response:', JSON.stringify(result));

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
        .update({ status: 'failed' })
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
