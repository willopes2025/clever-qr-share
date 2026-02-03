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

    const { conversationId, content, instanceId } = await req.json();

    if (!conversationId || !content || !instanceId) {
      throw new Error('conversationId, content and instanceId are required');
    }

    console.log(`Sending inbox message for conversation ${conversationId} via instance ${instanceId}`);

    // Get conversation with contact info
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        user_id,
        contact:contacts(id, phone, name, label_id)
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

    // Type-safe access to contact - cast through unknown first
    const contactData = conversation.contact as unknown as { id: string; phone: string; name: string | null; label_id: string | null } | null;
    if (!contactData || !contactData.phone) {
      console.error('Contact data:', JSON.stringify(conversation.contact));
      throw new Error('Contact not found');
    }
    
    // Format phone number - handle Label IDs (LID) from Click-to-WhatsApp Ads
    let phone = contactData.phone.replace(/\D/g, '');
    let remoteJid: string;
    
    console.log(`Original phone from contact: ${contactData.phone}, cleaned: ${phone}, label_id: ${contactData.label_id}`);
    
    // Check if this is a Label ID (LID) contact from Click-to-WhatsApp Ads
    const isLabelIdContact = contactData.phone.startsWith('LID_') || (contactData.label_id && phone.length > 13);
    
    if (isLabelIdContact) {
      // For Label ID contacts, we need to use the label_id as the remoteJid
      const labelId = contactData.label_id || phone;
      console.log(`[LID] Detected Label ID contact, using LID for remoteJid: ${labelId}`);
      remoteJid = `${labelId}@lid`;
    } else {
      // Validate phone number format for regular contacts
      // Brazilian phones: 10-11 digits without country code, 12-13 with country code (55)
      if (phone.length < 10) {
        console.error(`Invalid phone number format: ${phone}`);
        throw new Error(`Número de telefone inválido: ${contactData.phone}. O telefone precisa ter pelo menos 10 dígitos.`);
      }
      
      // Add Brazil country code if missing
      if (!phone.startsWith('55')) {
        phone = '55' + phone;
      }
      
      // Final validation: Brazilian phone with country code should be 12-13 digits
      if (phone.length < 12 || phone.length > 13) {
        console.error(`Phone number has invalid length after formatting: ${phone} (${phone.length} digits)`);
        throw new Error(`Número de telefone inválido: formato incorreto.`);
      }
      
      remoteJid = `${phone}@s.whatsapp.net`;
    }

    // Use evolution_instance_name if available, fallback to instance_name
    const evolutionName = instance.evolution_instance_name || instance.instance_name;
    console.log(`Sending message to ${remoteJid} via ${evolutionName} (display: ${instance.instance_name})`);

    // Create message record first with 'sending' status
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
    
    console.log(`Message created with sent_by_user_id: ${senderUserId}`);

    if (msgError) {
      console.error('Message insert error:', msgError);
      throw new Error('Failed to create message record');
    }

    // Send via Evolution API - use remoteJid which handles both regular phones and Label IDs
    // For LID contacts, we need to use a different payload structure
    const isLidMessage = remoteJid.endsWith('@lid');
    const sendPayload = isLidMessage 
      ? { number: remoteJid, options: { presence: 'composing' }, text: content }
      : { number: phone, text: content };
    
    console.log(`[SEND] Using payload:`, JSON.stringify(sendPayload));
    
    const response = await fetch(
      `${evolutionApiUrl}/message/sendText/${evolutionName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey
        },
        body: JSON.stringify(sendPayload)
      }
    );

    const result = await response.json();
    console.log('Evolution API response:', JSON.stringify(result));

    if (response.ok && result.key) {
      // Message sent successfully
      await supabase
        .from('inbox_messages')
        .update({ 
          status: 'sent',
          whatsapp_message_id: result.key.id
        })
        .eq('id', message.id);

      // Update conversation
      await supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: content.substring(0, 100),
          instance_id: instanceId,
        })
        .eq('id', conversationId);

      // Handle AI handoff logic when human agent sends message
      if (senderUserId) {
        // Fetch agent config to get custom emoji settings
        let pauseEmoji = '🛑'; // default
        let resumeEmoji = '✅'; // default

        // Get instance's default funnel to find the agent config
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
            console.log(`[HANDOFF] Using custom emojis - pause: ${pauseEmoji}, resume: ${resumeEmoji}`);
          }
        }

        // Also check for agent by campaign_id or instance owner
        if (pauseEmoji === '🛑' && resumeEmoji === '✅') {
          // Try to find agent by user_id (instance owner)
          const { data: ownerAgent } = await supabase
            .from('ai_agent_configs')
            .select('pause_emoji, resume_emoji')
            .eq('user_id', conversation.user_id)
            .eq('is_active', true)
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

          if (ownerAgent) {
            pauseEmoji = ownerAgent.pause_emoji || pauseEmoji;
            resumeEmoji = ownerAgent.resume_emoji || resumeEmoji;
            console.log(`[HANDOFF] Using owner agent emojis - pause: ${pauseEmoji}, resume: ${resumeEmoji}`);
          }
        }

        // Check if message contains pause or resume emoji
        const shouldPauseAI = pauseEmoji && content.includes(pauseEmoji);
        const shouldResumeAI = resumeEmoji && content.includes(resumeEmoji);

        // Also keep fallback text patterns for resume
        const textPatterns = [/\bok\b/i, /\bresumir\s*ia\b/i, /\bativar\s*ia\b/i];
        const hasResumeTextPattern = textPatterns.some(pattern => pattern.test(content));

        if (shouldResumeAI || hasResumeTextPattern) {
          // Resume AI - human is signaling AI should take over
          await supabase
            .from('conversations')
            .update({
              ai_paused: false,
              ai_handoff_requested: false,
              ai_handoff_reason: null,
            })
            .eq('id', conversationId);
          
          console.log(`[HANDOFF] AI resumed for conversation ${conversationId} by user ${senderUserId} (emoji: ${resumeEmoji})`);
        } else if (shouldPauseAI) {
          // Explicitly pause AI with custom emoji
          await supabase
            .from('conversations')
            .update({
              ai_paused: true,
              ai_handoff_requested: true,
              ai_handoff_reason: `Pausado via emoji ${pauseEmoji} pelo atendente`,
            })
            .eq('id', conversationId);
          
          console.log(`[HANDOFF] AI explicitly paused for conversation ${conversationId} via emoji ${pauseEmoji}`);
        } else {
          // Any other message from human pauses AI
          await supabase
            .from('conversations')
            .update({
              ai_paused: true,
              ai_handoff_requested: true,
              ai_handoff_reason: 'Atendente assumiu a conversa',
            })
            .eq('id', conversationId);
          
          console.log(`[HANDOFF] AI paused for conversation ${conversationId} - human (${senderUserId}) took over`);
        }
      }

      console.log(`Message sent successfully to ${phone}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Message sent successfully',
          messageId: message.id,
          whatsappMessageId: result.key.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Message failed - check for specific error types
      let errorMessage = result.message || result.error || 'Unknown error';
      
      // Check if instance doesn't exist in Evolution API
      if (response.status === 404 && result.response?.message) {
        const msgDetails = result.response.message;
        if (Array.isArray(msgDetails) && msgDetails.some((m: string) => m.includes('does not exist'))) {
          // Update instance status in database
          await supabase
            .from('whatsapp_instances')
            .update({ status: 'disconnected' })
            .eq('id', instanceId);
          
          errorMessage = `A instância WhatsApp "${instance.instance_name}" foi desconectada. Por favor, reconecte-a nas configurações.`;
          console.error(`Instance ${instance.instance_name} not found in Evolution API - marked as disconnected`);
        }
      }
      
      // Check if number doesn't exist on WhatsApp
      if (result.response?.message) {
        const msgDetails = result.response.message;
        if (Array.isArray(msgDetails) && msgDetails.length > 0 && msgDetails[0]?.exists === false) {
          errorMessage = `Este número (${phone}) não está registrado no WhatsApp. Verifique se o número está correto.`;
        }
      }
      
      await supabase
        .from('inbox_messages')
        .update({ 
          status: 'failed'
        })
        .eq('id', message.id);

      console.error(`Message failed: ${errorMessage}`);
      
      throw new Error(errorMessage);
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in send-inbox-message:', errorMessage);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
