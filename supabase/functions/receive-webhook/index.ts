import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper functions for media handling
function getExtension(messageType: string, mimeType?: string): string {
  // Try to get extension from mimeType first
  if (mimeType) {
    const parts = mimeType.split('/');
    if (parts.length === 2) {
      const subtype = parts[1].split(';')[0].trim();
      if (subtype === 'jpeg') return 'jpg';
      if (subtype === 'png') return 'png';
      if (subtype === 'webp') return 'webp';
      if (subtype === 'gif') return 'gif';
      if (subtype === 'mp4') return 'mp4';
      if (subtype === 'ogg') return 'ogg';
      if (subtype === 'mpeg') return 'mp3';
      if (subtype === 'pdf') return 'pdf';
    }
  }
  
  // Fallback based on messageType
  switch (messageType) {
    case 'image': return 'jpg';
    case 'audio': 
    case 'voice': return 'ogg';
    case 'video': return 'mp4';
    case 'document': return 'pdf';
    case 'sticker': return 'webp';
    default: return 'bin';
  }
}

function getMimeType(messageType: string): string {
  switch (messageType) {
    case 'image': return 'image/jpeg';
    case 'audio': return 'audio/ogg';
    case 'voice': return 'audio/ogg';
    case 'video': return 'video/mp4';
    case 'document': return 'application/pdf';
    case 'sticker': return 'image/webp';
    default: return 'application/octet-stream';
  }
}

// Helper function to check if a message is a reply to internal chat notification
async function checkAndHandleInternalChatReply(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  senderPhone: string,
  messageContent: string,
  instanceUserId: string,
  instanceId: string
): Promise<boolean> {
  // Format the phone to match stored format
  let formattedPhone = senderPhone.replace(/\D/g, '');
  if (!formattedPhone.startsWith('55')) {
    formattedPhone = '55' + formattedPhone;
  }

  // Check if this phone has a recent internal chat session
  const { data: session } = await supabase
    .from('internal_chat_sessions')
    .select('*')
    .eq('whatsapp_phone', formattedPhone)
    .order('last_activity_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    console.log('[INTERNAL-CHAT] No active session for phone:', formattedPhone);
    return false;
  }

  // Check if the session is recent (within 24 hours)
  const sessionTime = new Date(session.last_activity_at).getTime();
  const now = Date.now();
  const hoursDiff = (now - sessionTime) / (1000 * 60 * 60);

  if (hoursDiff > 24) {
    console.log('[INTERNAL-CHAT] Session too old, ignoring:', hoursDiff, 'hours');
    return false;
  }

  // Check if the message looks like a reply to internal chat (doesn't start with certain keywords)
  const ignorePrefixes = ['[chat interno', '💬 *[chat interno'];
  const lowerContent = messageContent.toLowerCase();
  for (const prefix of ignorePrefixes) {
    if (lowerContent.startsWith(prefix)) {
      console.log('[INTERNAL-CHAT] Message looks like our own notification, ignoring');
      return false;
    }
  }

  console.log('[INTERNAL-CHAT] Found active session, creating internal message:', session);

  // Insert the message into internal_messages
  const { error: insertError } = await supabase
    .from('internal_messages')
    .insert({
      user_id: session.user_id,
      conversation_id: session.conversation_id,
      contact_id: session.contact_id,
      content: messageContent,
      source: 'whatsapp',
      mentions: [],
    });

  if (insertError) {
    console.error('[INTERNAL-CHAT] Error inserting internal message:', insertError);
    return false;
  }

  // Update the session's last activity
  await supabase
    .from('internal_chat_sessions')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', session.id);

  console.log('[INTERNAL-CHAT] Internal message created successfully');
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!;
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;

    // Use service role to bypass RLS
    // deno-lint-ignore no-explicit-any
    const supabase = createClient(supabaseUrl, supabaseServiceKey) as any;

    const payload = await req.json();
    
    // Enhanced logging
    console.log('=== WEBHOOK RECEIVED ===');
    console.log('Full payload:', JSON.stringify(payload, null, 2));

    // Check if this is a Calendly webhook
    if (payload.event && (payload.event === 'invitee.created' || payload.event === 'invitee.canceled')) {
      console.log('>>> Handling CALENDLY webhook event:', payload.event);
      await handleCalendlyWebhook(supabase, payload);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { event, instance, data } = payload;
    
    console.log('Event type:', event);
    console.log('Instance:', instance);
    console.log('Data keys:', data ? Object.keys(data) : 'no data');

    if (!instance) {
      console.log('No instance in payload, ignoring');
      return new Response(JSON.stringify({ success: true, message: 'No instance' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get instance from database - try evolution_instance_name first, then fallback to instance_name
    let instanceData = null;
    
    // Try by evolution_instance_name first (matches Evolution API's internal name)
    const { data: byEvolutionName } = await supabase
      .from('whatsapp_instances')
      .select('id, user_id, default_funnel_id, is_notification_only')
      .eq('evolution_instance_name', instance)
      .single();

    if (byEvolutionName) {
      instanceData = byEvolutionName;
      console.log('Instance found by evolution_instance_name:', instance);
    } else {
      // Fallback to instance_name for backwards compatibility
      const { data: byInstanceName } = await supabase
        .from('whatsapp_instances')
        .select('id, user_id, default_funnel_id, is_notification_only')
        .eq('instance_name', instance)
        .single();
      
      instanceData = byInstanceName;
      if (instanceData) {
        console.log('Instance found by instance_name (fallback):', instance);
      }
    }

    if (!instanceData) {
      console.error('Instance not found by evolution_instance_name or instance_name:', instance);
      return new Response(JSON.stringify({ success: false, error: 'Instance not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = instanceData.user_id;
    const instanceId = instanceData.id;
    const isNotificationOnly = instanceData.is_notification_only === true;

    console.log(`Processing event ${event} for instance ${instance} (user: ${userId}, notification_only: ${isNotificationOnly})`);

    // If this is a notification-only instance, ignore incoming messages
    if (isNotificationOnly) {
      const eventLower = event?.toLowerCase() || '';
      // Only ignore message events, allow connection updates
      if (eventLower === 'messages.upsert' || eventLower === 'messages_upsert' || 
          eventLower === 'send.message' || eventLower === 'send_message') {
        console.log(`[NOTIFICATION-ONLY] Ignoring message event for notification-only instance: ${instance}`);
        return new Response(JSON.stringify({ success: true, message: 'Notification-only instance - message ignored' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Handle different event types - check multiple formats
    const eventLower = event?.toLowerCase() || '';
    
    const defaultFunnelId = instanceData.default_funnel_id;
    
    if (eventLower === 'messages.upsert' || eventLower === 'messages_upsert') {
      console.log('>>> Handling MESSAGES.UPSERT event');
      await handleMessagesUpsert(supabase, userId, instanceId, data, instance, evolutionApiUrl, evolutionApiKey, supabaseUrl, supabaseServiceKey, defaultFunnelId);
    } else if (eventLower === 'messages.update' || eventLower === 'messages_update') {
      console.log('>>> Handling MESSAGES.UPDATE event');
      await handleMessagesUpdate(supabase, data);
    } else if (eventLower === 'connection.update' || eventLower === 'connection_update') {
      console.log('>>> Handling CONNECTION.UPDATE event');
      await handleConnectionUpdate(supabase, instanceId, data);
    } else if (eventLower === 'send.message' || eventLower === 'send_message') {
      console.log('>>> Handling SEND.MESSAGE event');
      await handleMessagesUpsert(supabase, userId, instanceId, data, instance, evolutionApiUrl, evolutionApiKey, supabaseUrl, supabaseServiceKey, defaultFunnelId);
    } else {
      console.log(`Unhandled event type: ${event} (normalized: ${eventLower})`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in receive-webhook:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Handle Calendly webhook events
// deno-lint-ignore no-explicit-any
async function handleCalendlyWebhook(supabase: any, payload: any) {
  try {
    const eventType = payload.event; // invitee.created or invitee.canceled
    const eventPayload = payload.payload;
    
    if (!eventPayload) {
      console.error('[CALENDLY] No payload in webhook');
      return;
    }

    console.log('[CALENDLY] Processing event:', eventType);
    console.log('[CALENDLY] Event payload:', JSON.stringify(eventPayload, null, 2));

    // Extract data from payload
    const invitee = eventPayload.invitee;
    const scheduledEvent = eventPayload.scheduled_event;
    const canceledData = eventPayload.cancellation;

    if (!invitee || !scheduledEvent) {
      console.error('[CALENDLY] Missing invitee or scheduled_event');
      return;
    }

    // Find the integration by the organization URI or user URI in the event
    const schedulingLink = eventPayload.scheduling_link?.owner;
    
    let integration = null;
    if (schedulingLink) {
      const { data: integrationData } = await supabase
        .from('calendar_integrations')
        .select('*')
        .eq('user_uri', schedulingLink)
        .eq('provider', 'calendly')
        .eq('is_active', true)
        .single();
      
      integration = integrationData;
    }

    if (!integration) {
      // Try to find by organization
      const eventMembers = scheduledEvent.event_memberships;
      if (eventMembers && eventMembers.length > 0) {
        const userUri = eventMembers[0].user;
        const { data: integrationData } = await supabase
          .from('calendar_integrations')
          .select('*')
          .eq('user_uri', userUri)
          .eq('provider', 'calendly')
          .eq('is_active', true)
          .single();
        
        integration = integrationData;
      }
    }

    if (!integration) {
      console.error('[CALENDLY] Could not find integration for this event');
      return;
    }

    const userId = integration.user_id;
    console.log('[CALENDLY] Found integration for user:', userId);

    // Extract invitee information
    const inviteeName = invitee.name;
    const inviteeEmail = invitee.email;
    const inviteePhone = invitee.text_reminder_number || 
      (invitee.questions_and_answers?.find((q: { question: string; answer: string }) => 
        q.question.toLowerCase().includes('telefone') || 
        q.question.toLowerCase().includes('phone') ||
        q.question.toLowerCase().includes('whatsapp')
      )?.answer);

    // Check if event already exists
    const eventUri = scheduledEvent.uri;
    const { data: existingEvent } = await supabase
      .from('calendly_events')
      .select('id')
      .eq('calendly_event_uri', eventUri)
      .single();

    if (eventType === 'invitee.canceled') {
      // Update existing event as canceled
      if (existingEvent) {
        await supabase
          .from('calendly_events')
          .update({
            event_type: 'invitee.canceled',
            cancel_reason: canceledData?.reason || 'Cancelado pelo convidado',
            canceled_at: canceledData?.canceled_at || new Date().toISOString(),
          })
          .eq('id', existingEvent.id);
        
        console.log('[CALENDLY] Event marked as canceled:', existingEvent.id);
      }
      return;
    }

    // Create or update event record
    const eventData = {
      user_id: userId,
      integration_id: integration.id,
      calendly_event_uri: eventUri,
      event_type: eventType,
      event_name: scheduledEvent.name,
      invitee_name: inviteeName,
      invitee_email: inviteeEmail,
      invitee_phone: inviteePhone,
      event_start_time: scheduledEvent.start_time,
      event_end_time: scheduledEvent.end_time,
      location: scheduledEvent.location?.join_url || scheduledEvent.location?.location,
      raw_payload: payload,
      processed_at: new Date().toISOString(),
    };

    if (existingEvent) {
      await supabase
        .from('calendly_events')
        .update(eventData)
        .eq('id', existingEvent.id);
      
      console.log('[CALENDLY] Event updated:', existingEvent.id);
    } else {
      const { data: newEvent, error } = await supabase
        .from('calendly_events')
        .insert(eventData)
        .select('id')
        .single();

      if (error) {
        console.error('[CALENDLY] Error inserting event:', error);
      } else {
        console.log('[CALENDLY] Event created:', newEvent.id);
      }
    }

    // Try to match with existing contact by phone or email
    if (inviteePhone || inviteeEmail) {
      let contact = null;
      
      if (inviteePhone) {
        const normalizedPhone = inviteePhone.replace(/\D/g, '');
        const { data: contactByPhone } = await supabase
          .from('contacts')
          .select('id')
          .eq('user_id', userId)
          .or(`phone.eq.${normalizedPhone},phone.ilike.%${normalizedPhone}%`)
          .limit(1)
          .single();
        
        contact = contactByPhone;
      }

      if (!contact && inviteeEmail) {
        const { data: contactByEmail } = await supabase
          .from('contacts')
          .select('id')
          .eq('user_id', userId)
          .eq('email', inviteeEmail)
          .limit(1)
          .single();
        
        contact = contactByEmail;
      }

      if (contact) {
        console.log('[CALENDLY] Matched contact:', contact.id);
        
        // Update the calendly_event with contact_id
        await supabase
          .from('calendly_events')
          .update({ contact_id: contact.id })
          .eq('calendly_event_uri', eventUri);

        // Find conversation and update
        const { data: conversation } = await supabase
          .from('conversations')
          .select('id')
          .eq('user_id', userId)
          .eq('contact_id', contact.id)
          .single();

        if (conversation) {
          await supabase
            .from('calendly_events')
            .update({ conversation_id: conversation.id })
            .eq('calendly_event_uri', eventUri);
        }
      }
    }

    console.log('[CALENDLY] Webhook processed successfully');
  } catch (error) {
    console.error('[CALENDLY] Error processing webhook:', error);
  }
}

// deno-lint-ignore no-explicit-any
async function handleMessagesUpsert(supabase: any, userId: string, instanceId: string, data: any, instanceName: string, evolutionApiUrl: string, evolutionApiKey: string, supabaseUrl: string, supabaseServiceKey: string, defaultFunnelId: string | null) {
  console.log('handleMessagesUpsert called with data:', JSON.stringify(data, null, 2));
  
  const messages = data.messages || data.message ? [data] : [];
  
  console.log(`Processing ${messages.length} messages`);
  
  for (const msg of messages) {
    // Handle different payload formats
    const key = msg.key || data.key;
    const message = msg.message || data.message;
    const pushName = msg.pushName || data.pushName;
    const messageTimestamp = msg.messageTimestamp || data.messageTimestamp;
    
    console.log('Message key:', JSON.stringify(key));
    console.log('Message content:', JSON.stringify(message));
    console.log('PushName:', pushName);
    
    if (!key || !key.remoteJid) {
      console.log('Invalid message format - no key or remoteJid, skipping');
      console.log('Full msg object:', JSON.stringify(msg));
      continue;
    }

    const remoteJid = key.remoteJid;
    console.log('RemoteJid:', remoteJid);

    // Skip status messages
    if (remoteJid === 'status@broadcast') {
      console.log('Skipping status broadcast');
      continue;
    }

    // Skip group messages for now
    if (remoteJid.includes('@g.us')) {
      console.log('Skipping group message');
      continue;
    }

// Extract phone and label_id from JIDs
    // remoteJid can be either a real phone (@s.whatsapp.net/@c.us) or a Label ID (@lid)
    // remoteJidAlt usually contains the real phone when remoteJid is a Label ID
    let phone = '';
    let labelId: string | null = null;
    
    const extractPhone = (jid: string): string => {
      return jid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace('@lid', '');
    };
    
    const isValidPhone = (p: string): boolean => {
      return p.length >= 8 && p.length <= 15 && /^\d+$/.test(p);
    };
    
    // Normalize Brazilian phone numbers - always include country code
    const normalizePhone = (p: string): string => {
      let cleaned = p.replace(/\D/g, '');
      
      // If already has country code 55 and correct length (12-13 digits)
      if (cleaned.startsWith('55') && cleaned.length >= 12 && cleaned.length <= 13) {
        return cleaned;
      }
      
      // Brazilian mobile without country code (10-11 digits starting with DDD)
      if (cleaned.length >= 10 && cleaned.length <= 11) {
        return '55' + cleaned;
      }
      
      return cleaned;
    };
    
    // Determine if remoteJid is a Label ID
    if (remoteJid.includes('@lid')) {
      labelId = extractPhone(remoteJid);
      console.log('[LID] Detected Label ID (Click-to-WhatsApp Ads):', labelId);
      
      // Try to get real phone from remoteJidAlt
      if (key.remoteJidAlt && (key.remoteJidAlt.includes('@s.whatsapp.net') || key.remoteJidAlt.includes('@c.us'))) {
        phone = extractPhone(key.remoteJidAlt);
        console.log('[LID] Extracted real phone from remoteJidAlt:', phone);
      }
      
      // Try alternative fields if remoteJidAlt doesn't have the phone
      if (!isValidPhone(phone)) {
        // Check data.participant (sometimes sent by Evolution API)
        if (data.participant && (data.participant.includes('@s.whatsapp.net') || data.participant.includes('@c.us'))) {
          phone = extractPhone(data.participant);
          console.log('[LID] Extracted phone from data.participant:', phone);
        }
        
        // Check msg.participant
        if (!isValidPhone(phone) && msg.participant && (msg.participant.includes('@s.whatsapp.net') || msg.participant.includes('@c.us'))) {
          phone = extractPhone(msg.participant);
          console.log('[LID] Extracted phone from msg.participant:', phone);
        }
        
        // Check contextInfo.participant (for reply messages)
        const contextInfo = message?.contextInfo || message?.extendedTextMessage?.contextInfo;
        if (!isValidPhone(phone) && contextInfo?.participant) {
          const ctxParticipant = contextInfo.participant;
          if (ctxParticipant.includes('@s.whatsapp.net') || ctxParticipant.includes('@c.us')) {
            phone = extractPhone(ctxParticipant);
            console.log('[LID] Extracted phone from contextInfo.participant:', phone);
          }
        }
      }
    } else {
      // remoteJid is a real phone number
      phone = extractPhone(remoteJid);
      
      // Check if remoteJidAlt is a Label ID
      if (key.remoteJidAlt && key.remoteJidAlt.includes('@lid')) {
        labelId = extractPhone(key.remoteJidAlt);
        console.log('Detected Label ID from remoteJidAlt:', labelId);
      }
    }
    
    // Handle Click-to-WhatsApp Ads: If we have a LID but no valid phone, try to find existing contact or create with LID
    let useLidAsIdentifier = false;
    if (!isValidPhone(phone) && labelId) {
      console.log('[LID] No valid phone found, checking for existing contact by label_id:', labelId);
      
      // Try to find existing contact by label_id
      const { data: existingContactByLid } = await supabase
        .from('contacts')
        .select('id, phone, name')
        .eq('user_id', userId)
        .eq('label_id', labelId)
        .single();
      
      if (existingContactByLid) {
        phone = existingContactByLid.phone;
        console.log('[LID] Found existing contact by LID, using phone:', phone);
      } else {
        // Use LID as temporary phone identifier to allow message processing
        phone = `LID_${labelId}`;
        useLidAsIdentifier = true;
        console.log('[LID] No existing contact found, using LID as temporary identifier:', phone);
      }
    }
    
    // Validate phone (now allowing LID identifiers)
    if (!isValidPhone(phone) && !useLidAsIdentifier) {
      console.error(`Invalid phone extracted: ${phone}, labelId: ${labelId}`);
      console.error('Could not extract valid phone number, skipping message');
      continue;
    }
    
    // Normalize the phone number to prevent duplicates (skip for LID identifiers)
    const originalPhone = phone;
    if (!useLidAsIdentifier) {
      phone = normalizePhone(phone);
    }
    console.log(`Extracted phone: ${originalPhone} -> normalized: ${phone}, labelId: ${labelId}, useLidAsIdentifier: ${useLidAsIdentifier}`);

    // Detect message type and extract content/media
    let messageType = 'text';
    let mediaUrl: string | null = null;
    let content = '';

    // Text message
    if (message?.conversation) {
      content = message.conversation;
    } else if (message?.extendedTextMessage?.text) {
      content = message.extendedTextMessage.text;
    }

    // Image message
    if (message?.imageMessage) {
      messageType = 'image';
      mediaUrl = message.imageMessage.url || null;
      content = message.imageMessage.caption || '';
      console.log('Detected IMAGE message, url:', mediaUrl);
    }

    // Audio/Voice message
    if (message?.audioMessage) {
      messageType = message.audioMessage.ptt ? 'voice' : 'audio';
      mediaUrl = message.audioMessage.url || null;
      console.log('Detected AUDIO message, ptt:', message.audioMessage.ptt, 'url:', mediaUrl);
    }

    // Video message
    if (message?.videoMessage) {
      messageType = 'video';
      mediaUrl = message.videoMessage.url || null;
      content = message.videoMessage.caption || '';
      console.log('Detected VIDEO message, url:', mediaUrl);
    }

    // Document message
    if (message?.documentMessage) {
      messageType = 'document';
      mediaUrl = message.documentMessage.url || null;
      
      // Capture filename
      const fileName = message.documentMessage.fileName || 'Documento';
      
      // Check for caption/title (text preview from PDF)
      const caption = message.documentMessage.caption || 
                      message.documentMessage.title || '';
      
      // If there's a caption, include it with the filename
      content = caption ? `${fileName}\n\n${caption}` : fileName;
      
      console.log('Detected DOCUMENT message, fileName:', fileName, 'caption:', caption, 'url:', mediaUrl);
    }

    // Sticker message
    if (message?.stickerMessage) {
      messageType = 'sticker';
      mediaUrl = message.stickerMessage.url || null;
      console.log('Detected STICKER message, url:', mediaUrl);
    }

    // Skip if no content AND no media
    if (!content && !mediaUrl) {
      console.log('No content or media found in message, skipping');
      console.log('Message structure:', JSON.stringify(message));
      continue;
    }

    // If there's media, download from Evolution API and upload to Supabase Storage
    let persistedMediaUrl: string | null = null;
    if (mediaUrl && messageType !== 'text') {
      try {
        console.log('Downloading media from Evolution API...');
        
        // Call Evolution API to get base64 of the media
        const base64Response = await fetch(
          `${evolutionApiUrl}/chat/getBase64FromMediaMessage/${instanceName}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': evolutionApiKey,
            },
            body: JSON.stringify({
              message: { key },
              convertToMp4: messageType === 'audio' || messageType === 'voice',
            }),
          }
        );

        if (base64Response.ok) {
          const base64Data = await base64Response.json();
          console.log('Base64 response received, has base64:', !!base64Data.base64);
          
          if (base64Data.base64) {
            // Determine file extension and mime type
            const mimeType = base64Data.mimetype || getMimeType(messageType);
            const ext = getExtension(messageType, mimeType);
            const fileName = `${Date.now()}-${key.id}.${ext}`;
            const filePath = `${userId}/${fileName}`;
            
            console.log(`Uploading to storage: ${filePath}, mimeType: ${mimeType}`);
            
            // Decode base64 to binary
            const binaryData = Uint8Array.from(atob(base64Data.base64), c => c.charCodeAt(0));
            
            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase
              .storage
              .from('inbox-media')
              .upload(filePath, binaryData, {
                contentType: mimeType,
                upsert: true,
              });

            if (uploadError) {
              console.error('Error uploading to storage:', uploadError);
            } else {
              // Get public URL
              const { data: publicUrlData } = supabase
                .storage
                .from('inbox-media')
                .getPublicUrl(filePath);
              
              persistedMediaUrl = publicUrlData.publicUrl;
              console.log('Media saved to storage:', persistedMediaUrl);
            }
          }
        } else {
          console.error('Error fetching base64 from Evolution API:', base64Response.status, await base64Response.text());
        }
      } catch (error) {
        console.error('Error downloading/uploading media:', error);
        // Keep original URL as fallback
      }
    }

    // Use persisted URL if available, otherwise fallback to original
    const finalMediaUrl = persistedMediaUrl || mediaUrl;

    const isFromMe = key.fromMe === true;
    
    // Helper function to validate contact names
    const isValidContactName = (name: string | undefined | null): boolean => {
      if (!name || name.trim().length < 2) return false;
      if (name.startsWith('LID_')) return false;
      if (/^\d+$/.test(name)) return false; // Only numbers
      if (/^55\d{10,11}$/.test(name)) return false; // BR phone number
      return true;
    };
    
    // Don't use pushName for outgoing messages (would be "Você" or similar)
    const rawContactName = (!isFromMe && pushName) ? pushName : null;
    const contactName = isValidContactName(rawContactName) ? rawContactName! : 'Cliente';
    
    console.log(`Processing: phone=${phone}, labelId=${labelId}, useLidAsIdentifier=${useLidAsIdentifier}, fromMe=${isFromMe}, type=${messageType}, hasMedia=${!!mediaUrl}, content=${content.substring(0, 50)}...`);

    // Find contact by phone OR by label_id (to prevent duplicates)
    // Also search for phone without country code to handle legacy data
    let contact = null;
    
    if (useLidAsIdentifier) {
      // For LID identifiers, search primarily by label_id
      console.log('[LID] Searching contact by label_id:', labelId);
      const { data: contactByLabel } = await supabase
        .from('contacts')
        .select('id, phone, label_id, name')
        .eq('user_id', userId)
        .eq('label_id', labelId)
        .single();
      
      if (contactByLabel) {
        contact = contactByLabel;
        console.log('[LID] Found existing contact by label_id:', contact.id);
      }
    } else {
      // Normal phone search
      const phoneWithoutCountry = phone.startsWith('55') ? phone.substring(2) : phone;
      
      const { data: contactByPhone } = await supabase
        .from('contacts')
        .select('id, label_id, phone')
        .eq('user_id', userId)
        .or(`phone.eq.${phone},phone.eq.${phoneWithoutCountry}`)
        .limit(1)
        .single();
      
      contact = contactByPhone;

      // If not found by phone, try to find by label_id
      if (!contact && labelId) {
        const { data: contactByLabel } = await supabase
          .from('contacts')
          .select('id, phone, label_id')
          .eq('user_id', userId)
          .eq('label_id', labelId)
          .single();
        
        if (contactByLabel) {
          console.log(`Found existing contact by label_id: ${contactByLabel.id} (phone: ${contactByLabel.phone})`);
          // Update the contact's phone to normalized version if we have a real phone now
          if (contactByLabel.phone.startsWith('LID_') && isValidPhone(phone)) {
            console.log(`[LID] Upgrading contact phone from LID to real phone: ${phone}`);
            await supabase
              .from('contacts')
              .update({ phone: phone })
              .eq('id', contactByLabel.id);
          } else {
            const normalizedExisting = normalizePhone(contactByLabel.phone);
            if (normalizedExisting !== phone && !contactByLabel.phone.startsWith('LID_')) {
              console.log(`Updating contact phone from ${contactByLabel.phone} to ${phone}`);
              await supabase
                .from('contacts')
                .update({ phone: phone })
                .eq('id', contactByLabel.id);
            }
          }
          contact = contactByLabel;
        }
      }
      
      // If found contact with non-normalized phone, update it (skip LID phones)
      if (contact && contact.phone !== phone && !contact.phone.startsWith('LID_')) {
        console.log(`Normalizing contact phone from ${contact.phone} to ${phone}`);
        await supabase
          .from('contacts')
          .update({ phone: phone })
          .eq('id', contact.id);
      }
    }

    if (!contact) {
      // Fetch profile picture from WhatsApp before creating contact
      let avatarUrl: string | null = null;
      try {
        console.log(`[PROFILE-PIC] Fetching profile picture for new contact ${phone}...`);
        const profileResponse = await fetch(
          `${evolutionApiUrl}/chat/fetchProfile/${instanceName}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': evolutionApiKey,
            },
            body: JSON.stringify({ number: phone }),
          }
        );
        
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          avatarUrl = profileData.profilePictureUrl || profileData.picture || profileData.imgUrl || profileData.profilePicUrl || null;
          if (avatarUrl) {
            console.log(`[PROFILE-PIC] Found profile picture for ${phone}`);
          }
        }
      } catch (profileError) {
        console.error('[PROFILE-PIC] Error fetching profile:', profileError);
      }

      // Create new contact with label_id if available - using UPSERT to handle race conditions
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .upsert({
          user_id: userId,
          phone: phone,
          name: contactName,
          status: 'active',
          label_id: labelId,
          avatar_url: avatarUrl,
        }, { 
          onConflict: 'user_id,phone',
          ignoreDuplicates: false 
        })
        .select('id, phone, label_id, name')
        .single();

      if (contactError) {
        // May have been created by parallel request - try to fetch existing
        console.log('Upsert conflict, trying to fetch existing contact:', contactError.message);
        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id, phone, label_id, name')
          .eq('user_id', userId)
          .eq('phone', phone)
          .single();
          
        if (existingContact) {
          contact = existingContact;
          console.log('Contact found after upsert conflict:', contact.id);
        } else {
          console.error('Error creating contact and could not find existing:', contactError);
          continue;
        }
      } else {
        contact = newContact;
        console.log('Created/updated contact:', contact?.id, 'with label_id:', labelId, 'avatar_url:', avatarUrl ? 'yes' : 'no');
      }
    } else if (labelId && !contact.label_id) {
      // Update existing contact to add label_id for future matching
      console.log(`Updating contact ${contact.id} with label_id: ${labelId}`);
      await supabase
        .from('contacts')
        .update({ label_id: labelId })
        .eq('id', contact.id);
    }

    if (!contact) {
      console.error('Could not find or create contact');
      continue;
    }

    // Find or create conversation - buscar por contact_id independente da instância
    let { data: conversation } = await supabase
      .from('conversations')
      .select('id, unread_count, first_response_at, created_at, assigned_to, instance_id')
      .eq('user_id', userId)
      .eq('contact_id', contact.id)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .single();

    // Se a conversa existe mas com instância diferente, atualizar instance_id
    if (conversation && conversation.instance_id !== instanceId) {
      console.log(`[CONVERSATION] Updating instance_id from ${conversation.instance_id} to ${instanceId} for conversation ${conversation.id}`);
      await supabase
        .from('conversations')
        .update({ instance_id: instanceId })
        .eq('id', conversation.id);
    }

    // Generate preview for conversation list
    let preview = content?.substring(0, 100) || '';
    if (!preview) {
      if (messageType === 'image') preview = '📷 Imagem';
      else if (messageType === 'audio' || messageType === 'voice') preview = '🎵 Áudio';
      else if (messageType === 'video') preview = '🎬 Vídeo';
      else if (messageType === 'document') preview = '📄 Documento';
      else if (messageType === 'sticker') preview = '🏷️ Figurinha';
    }

    if (!conversation) {
      // Try to get assigned_to via round-robin distribution
      let assignedTo: string | null = null;
      
      try {
        // First, find the organization for this user via team_members
        const { data: teamMember } = await supabase
          .from('team_members')
          .select('organization_id')
          .eq('user_id', userId)
          .eq('status', 'active')
          .limit(1)
          .single();
        
        const orgId = teamMember?.organization_id;
        
        if (orgId) {
          // Check if lead distribution is enabled for this organization
          const { data: distributionSettings } = await supabase
            .from('lead_distribution_settings')
            .select('*')
            .eq('organization_id', orgId)
            .eq('is_enabled', true)
            .single();
          
          if (distributionSettings && distributionSettings.eligible_members?.length > 0) {
            const eligibleMembers = distributionSettings.eligible_members;
            const lastIndex = distributionSettings.last_assigned_index || 0;
            
            // Round-robin: get next member
            const nextIndex = (lastIndex + 1) % eligibleMembers.length;
            assignedTo = eligibleMembers[nextIndex];
            
            console.log(`[LEAD-DISTRIBUTION] Assigned conversation to member ${assignedTo} (index ${nextIndex})`);
            
            // Update last_assigned_index
            await supabase
              .from('lead_distribution_settings')
              .update({ last_assigned_index: nextIndex })
              .eq('id', distributionSettings.id);
          }
        }
      } catch (distError) {
        console.log('[LEAD-DISTRIBUTION] No distribution settings or not enabled:', distError);
      }
      
      // Create new conversation - using UPSERT to handle race conditions
      const { data: newConversation, error: convError } = await supabase
        .from('conversations')
        .upsert({
          user_id: userId,
          contact_id: contact.id,
          instance_id: instanceId,
          status: 'active',
          unread_count: isFromMe ? 0 : 1,
          last_message_at: new Date().toISOString(),
          last_message_preview: preview,
          assigned_to: assignedTo,
        }, { 
          onConflict: 'user_id,contact_id' 
        })
        .select('id, unread_count, first_response_at, created_at, assigned_to, instance_id')
        .single();

      if (convError) {
        // May have been created by parallel request - try to fetch existing
        console.log('Conversation upsert conflict, trying to fetch existing:', convError.message);
        const { data: existingConv } = await supabase
          .from('conversations')
          .select('id, unread_count, first_response_at, created_at, assigned_to, instance_id')
          .eq('user_id', userId)
          .eq('contact_id', contact.id)
          .single();
          
        if (existingConv) {
          conversation = existingConv;
          console.log('Conversation found after upsert conflict:', conversation.id);
        } else {
          console.error('Error creating conversation and could not find existing:', convError);
          continue;
        }
      } else {
        conversation = newConversation;
        console.log('Created/updated conversation:', conversation?.id, 'assigned_to:', assignedTo);
      }
      
      // Auto-create deal if instance has default funnel and is incoming message
      if (defaultFunnelId && !isFromMe && conversation) {
        await createDealFromNewConversation(supabase, userId, defaultFunnelId, contact.id, conversation.id, contact.name || phone);
      }
    } else {
      // Update conversation
      // deno-lint-ignore no-explicit-any
      const updateData: any = {
        last_message_at: new Date().toISOString(),
        last_message_preview: preview,
        instance_id: instanceId,
      };
      
      if (!isFromMe) {
        // Increment unread count for incoming messages
        updateData.unread_count = (conversation.unread_count || 0) + 1;
      }
      
      // Track first_response_at for SLA calculation (outbound message after conversation creation)
      if (isFromMe && !conversation.first_response_at) {
        updateData.first_response_at = new Date().toISOString();
        console.log('[SLA] First response tracked for conversation:', conversation.id);
        
        // Update SLA metrics for the user
        await updateSLAMetrics(supabase, userId, conversation.id, conversation.created_at);
      }

      await supabase
        .from('conversations')
        .update(updateData)
        .eq('id', conversation.id);
        
      // Ensure deal exists for existing conversations when instance has funnel
      // This handles the case where funnel was linked after conversation was created
      if (defaultFunnelId && !isFromMe) {
        await ensureDealExistsForConversation(supabase, userId, defaultFunnelId, contact.id, conversation.id, contact.name || phone);
      }
    }

    if (!conversation) {
      console.error('Could not find or create conversation');
      continue;
    }

    // Check if message already exists (by whatsapp_message_id)
    const { data: existingMessage } = await supabase
      .from('inbox_messages')
      .select('id')
      .eq('whatsapp_message_id', key.id)
      .single();

    if (existingMessage) {
      console.log('Message already exists, skipping');
      continue;
    }

    // Insert message with media support
    // Note: direction must be 'inbound' or 'outbound' per database constraint
    const { error: msgError } = await supabase
      .from('inbox_messages')
      .insert({
        user_id: userId,
        conversation_id: conversation.id,
        content: content || (finalMediaUrl ? preview : ''),
        direction: isFromMe ? 'outbound' : 'inbound',
        status: isFromMe ? 'sent' : 'received',
        message_type: messageType,
        media_url: finalMediaUrl,
        whatsapp_message_id: key.id,
        sent_at: messageTimestamp ? new Date(messageTimestamp * 1000).toISOString() : new Date().toISOString(),
      });

    if (msgError) {
      console.error('Error inserting message:', msgError);
    } else {
      console.log('Message inserted successfully');
      
      // Check if this is a warming message (inbound only)
      if (!isFromMe) {
        // Check if this is a reply to an internal chat notification
        const isInternalChatReply = await checkAndHandleInternalChatReply(
          supabase, 
          phone, 
          content || preview, 
          userId,
          instanceId
        );

        if (isInternalChatReply) {
          console.log('[INTERNAL-CHAT] Message handled as internal chat reply');
          // Skip normal notification and AI processing for internal chat replies
        } else {
          // Send WhatsApp notification for inbound message
          try {
            console.log('[NOTIFICATION] Sending notification for inbound message');
            const notificationResponse = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                type: 'new_message',
                data: {
                  conversationId: conversation.id,
                  contactName: contact.name || phone,
                  message: content?.substring(0, 100) || preview,
                },
              }),
            });
            
            const notifResult = await notificationResponse.json();
            console.log('[NOTIFICATION] Result:', notifResult);
          } catch (notifError) {
            console.error('[NOTIFICATION] Error sending notification:', notifError);
          }
        }
        
        // For audio messages, transcribe before triggering AI
        let effectiveContent = content || preview;
        
        // Trigger funnel automations for on_message_received
        await triggerFunnelAutomationsForMessage(supabase, userId, contact.id, conversation.id, effectiveContent, supabaseUrl, supabaseServiceKey);
        
        if ((messageType === 'audio' || messageType === 'voice' || messageType === 'ptt') && finalMediaUrl) {
          console.log('[AUDIO-TRANSCRIPTION] Audio message detected, transcribing before AI trigger...');
          
          // Get the ID of the message we just inserted
          const { data: insertedMessage } = await supabase
            .from('inbox_messages')
            .select('id')
            .eq('whatsapp_message_id', key.id)
            .single();
          
          if (insertedMessage?.id) {
            try {
              // Call transcribe-audio edge function
              const transcriptionResponse = await fetch(`${supabaseUrl}/functions/v1/transcribe-audio`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({
                  messageId: insertedMessage.id,
                  audioUrl: finalMediaUrl,
                }),
              });
              
              const transcriptionResult = await transcriptionResponse.json();
              
              if (transcriptionResult.success && transcriptionResult.transcription) {
                effectiveContent = transcriptionResult.transcription;
                console.log('[AUDIO-TRANSCRIPTION] Audio transcribed successfully:', effectiveContent.substring(0, 100) + '...');
              } else {
                console.log('[AUDIO-TRANSCRIPTION] Transcription failed or empty, using original preview');
              }
            } catch (transcriptionError) {
              console.error('[AUDIO-TRANSCRIPTION] Error transcribing audio:', transcriptionError);
              // Continue with original preview if transcription fails
            }
          }
        }
        
        await checkAndCountWarmingMessage(supabase, userId, instanceId, phone, effectiveContent);
        
        // Check if conversation has AI agent enabled and trigger response with transcription
        // Pass the message type so AI can mirror the format (text vs audio)
        await triggerAIAgentIfEnabled(supabaseUrl, supabaseServiceKey, conversation.id, effectiveContent, instanceName, instanceId, messageType);
      }
    }
  }
}

// Trigger AI agent for campaign or funnel conversations
async function triggerAIAgentIfEnabled(supabaseUrl: string, supabaseServiceKey: string, conversationId: string, messageContent: string, instanceName: string, instanceId: string, incomingMessageType: string = 'text') {
  try {
    console.log(`[AI-TRIGGER] Checking if AI agent should respond for conversation ${conversationId}, messageType: ${incomingMessageType}`);
    
    // Call the AI agent edge function
    const response = await fetch(`${supabaseUrl}/functions/v1/ai-campaign-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        conversationId,
        messageContent,
        instanceName,
        instanceId,
        incomingMessageType, // Pass the type of the incoming message for adaptive response
      }),
    });

    const result = await response.json();
    console.log(`[AI-TRIGGER] AI agent response:`, result);
    
  } catch (error) {
    console.error('[AI-TRIGGER] Error calling AI agent:', error);
  }
}

// Trigger funnel automations when a message is received
// deno-lint-ignore no-explicit-any
async function triggerFunnelAutomationsForMessage(supabase: any, userId: string, contactId: string, conversationId: string, messageContent: string, supabaseUrl: string, supabaseServiceKey: string) {
  try {
    console.log(`[FUNNEL-MESSAGE-AUTOMATION] Checking for message-based automations for contact ${contactId}`);
    
    // Find all active deals for this contact (could be in multiple funnels)
    const { data: deals, error: dealsError } = await supabase
      .from('funnel_deals')
      .select('id, stage_id, funnel_id')
      .eq('contact_id', contactId)
      .is('closed_at', null); // Only open deals
    
    if (dealsError) {
      console.error('[FUNNEL-MESSAGE-AUTOMATION] Error fetching deals:', dealsError);
      return;
    }
    
    if (!deals || deals.length === 0) {
      console.log('[FUNNEL-MESSAGE-AUTOMATION] No active deals for this contact');
      return;
    }
    
    console.log(`[FUNNEL-MESSAGE-AUTOMATION] Found ${deals.length} active deals for contact`);
    
    // Trigger automations for each deal
    for (const deal of deals) {
      try {
        console.log(`[FUNNEL-MESSAGE-AUTOMATION] Triggering for deal ${deal.id} in stage ${deal.stage_id}`);
        
        const automationResponse = await fetch(`${supabaseUrl}/functions/v1/process-funnel-automations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            dealId: deal.id,
            triggerType: 'on_message_received',
            messageContent: messageContent,
          }),
        });
        
        const automationResult = await automationResponse.json();
        console.log(`[FUNNEL-MESSAGE-AUTOMATION] Result for deal ${deal.id}:`, JSON.stringify(automationResult));
      } catch (dealAutoError) {
        console.error(`[FUNNEL-MESSAGE-AUTOMATION] Error processing deal ${deal.id}:`, dealAutoError);
      }
    }
  } catch (error) {
    console.error('[FUNNEL-MESSAGE-AUTOMATION] Error:', error);
  }
}

// Create a deal in the funnel when a new conversation is created
// deno-lint-ignore no-explicit-any
async function createDealFromNewConversation(supabase: any, userId: string, funnelId: string, contactId: string, conversationId: string, contactName: string) {
  try {
    console.log(`[FUNNEL-DEAL] Creating deal for conversation ${conversationId} in funnel ${funnelId}`);
    
    // Check if deal already exists for this contact in this funnel
    const { data: existingDeal } = await supabase
      .from('funnel_deals')
      .select('id')
      .eq('contact_id', contactId)
      .eq('funnel_id', funnelId)
      .limit(1)
      .single();
    
    if (existingDeal) {
      console.log(`[FUNNEL-DEAL] Deal already exists for contact in this funnel: ${existingDeal.id}`);
      // Update the conversation_id on the existing deal if not set
      await supabase
        .from('funnel_deals')
        .update({ conversation_id: conversationId })
        .eq('id', existingDeal.id)
        .is('conversation_id', null);
      return;
    }
    
    // Get first stage of the funnel
    const { data: firstStage, error: stageError } = await supabase
      .from('funnel_stages')
      .select('id')
      .eq('funnel_id', funnelId)
      .order('display_order', { ascending: true })
      .limit(1)
      .single();
    
    if (stageError || !firstStage) {
      console.error('[FUNNEL-DEAL] Could not find first stage:', stageError);
      return;
    }
    
    // Create the deal
    const { data: newDeal, error: dealError } = await supabase
      .from('funnel_deals')
      .insert({
        user_id: userId,
        funnel_id: funnelId,
        stage_id: firstStage.id,
        contact_id: contactId,
        conversation_id: conversationId,
        title: `Lead - ${contactName}`,
        value: 0,
        source: 'whatsapp',
      })
      .select('id')
      .single();
    
    if (dealError) {
      console.error('[FUNNEL-DEAL] Error creating deal:', dealError);
    } else {
      console.log(`[FUNNEL-DEAL] Deal created successfully: ${newDeal?.id}`);
      
      // Trigger funnel automations for the new deal entering the first stage
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        
        console.log(`[FUNNEL-AUTOMATIONS] Triggering automations for new deal ${newDeal?.id} entering stage ${firstStage.id}`);
        
        const automationResponse = await fetch(`${supabaseUrl}/functions/v1/process-funnel-automations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            dealId: newDeal?.id,
            toStageId: firstStage.id,
            triggerType: 'on_stage_enter',
          }),
        });
        
        const automationResult = await automationResponse.json();
        console.log(`[FUNNEL-AUTOMATIONS] Result:`, JSON.stringify(automationResult));
      } catch (autoError) {
        console.error('[FUNNEL-AUTOMATIONS] Error triggering automations:', autoError);
      }
    }
    
  } catch (error) {
    console.error('[FUNNEL-DEAL] Error in createDealFromNewConversation:', error);
  }
}

// Ensure a deal exists for an existing conversation (when funnel was linked after conversation was created)
// deno-lint-ignore no-explicit-any
async function ensureDealExistsForConversation(supabase: any, userId: string, funnelId: string, contactId: string, conversationId: string, contactName: string) {
  try {
    // Check if deal already exists for this contact in this funnel
    const { data: existingDeal } = await supabase
      .from('funnel_deals')
      .select('id')
      .eq('contact_id', contactId)
      .eq('funnel_id', funnelId)
      .limit(1)
      .single();
    
    if (existingDeal) {
      // Deal exists, just ensure conversation_id is set
      await supabase
        .from('funnel_deals')
        .update({ conversation_id: conversationId })
        .eq('id', existingDeal.id)
        .is('conversation_id', null);
      return;
    }
    
    // No deal exists, create one
    console.log(`[FUNNEL-DEAL] Creating deal for existing conversation ${conversationId}`);
    
    const { data: firstStage } = await supabase
      .from('funnel_stages')
      .select('id')
      .eq('funnel_id', funnelId)
      .order('display_order', { ascending: true })
      .limit(1)
      .single();
    
    if (!firstStage) {
      console.error('[FUNNEL-DEAL] No first stage found for funnel');
      return;
    }
    
    const { data: newDeal, error: dealError } = await supabase
      .from('funnel_deals')
      .insert({
        user_id: userId,
        funnel_id: funnelId,
        stage_id: firstStage.id,
        contact_id: contactId,
        conversation_id: conversationId,
        title: `Lead - ${contactName}`,
        value: 0,
        source: 'whatsapp',
      })
      .select('id')
      .single();
    
    if (dealError) {
      console.error('[FUNNEL-DEAL] Error creating deal:', dealError);
    } else {
      console.log(`[FUNNEL-DEAL] Deal created for existing conversation: ${newDeal?.id}`);
      
      // Trigger funnel automations for the new deal entering the first stage
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        
        console.log(`[FUNNEL-AUTOMATIONS] Triggering automations for deal ${newDeal?.id} entering stage ${firstStage.id}`);
        
        const automationResponse = await fetch(`${supabaseUrl}/functions/v1/process-funnel-automations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            dealId: newDeal?.id,
            toStageId: firstStage.id,
            triggerType: 'on_stage_enter',
          }),
        });
        
        const automationResult = await automationResponse.json();
        console.log(`[FUNNEL-AUTOMATIONS] Result:`, JSON.stringify(automationResult));
      } catch (autoError) {
        console.error('[FUNNEL-AUTOMATIONS] Error triggering automations:', autoError);
      }
    }
    
  } catch (error) {
    console.error('[FUNNEL-DEAL] Error in ensureDealExistsForConversation:', error);
  }
}

// Check if incoming message is from a warming contact or paired instance and update counters
// deno-lint-ignore no-explicit-any
async function checkAndCountWarmingMessage(supabase: any, userId: string, instanceId: string, phone: string, contentPreview: string) {
  try {
    console.log(`[WARMING] Checking if message from ${phone} is a warming message for instance ${instanceId}`);
    
    // Find active warming schedule for this instance
    const { data: schedule, error: scheduleError } = await supabase
      .from('warming_schedules')
      .select('id, messages_received_today, total_messages_received')
      .eq('instance_id', instanceId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();
    
    if (scheduleError) {
      console.error('[WARMING] Error fetching schedule:', scheduleError);
      return;
    }
    
    if (!schedule) {
      console.log('[WARMING] No active warming schedule for this instance');
      return;
    }
    
    console.log(`[WARMING] Found active schedule: ${schedule.id}`);
    
    // Check if message is from a warming contact
    const { data: warmingContact } = await supabase
      .from('warming_contacts')
      .select('id')
      .eq('user_id', userId)
      .eq('phone', phone)
      .eq('is_active', true)
      .maybeSingle();
    
    let isWarmingMessage = !!warmingContact;
    
    if (warmingContact) {
      console.log(`[WARMING] Message is from warming contact: ${warmingContact.id}`);
    }
    
    // If not a warming contact, check if it's from a paired instance
    if (!isWarmingMessage) {
      // Get the phone number of paired instances
      const { data: pairs } = await supabase
        .from('warming_pairs')
        .select(`
          id,
          instance_a_id,
          instance_b_id,
          instance_a:whatsapp_instances!warming_pairs_instance_a_id_fkey(id, instance_name),
          instance_b:whatsapp_instances!warming_pairs_instance_b_id_fkey(id, instance_name)
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .or(`instance_a_id.eq.${instanceId},instance_b_id.eq.${instanceId}`);
      
      if (pairs && pairs.length > 0) {
        console.log(`[WARMING] Found ${pairs.length} active pairs for this instance`);
        
        // For each pair, check if the message phone matches the paired instance's connected number
        // Since we don't store the connected phone number directly, we'll check warming_schedules
        // of the paired instance to see if any messages were sent from there
        for (const pair of pairs) {
          const pairedInstanceId = pair.instance_a_id === instanceId 
            ? pair.instance_b_id 
            : pair.instance_a_id;
          
          // Check if there's a warming schedule for the paired instance that sent messages
          const { data: pairedSchedule } = await supabase
            .from('warming_schedules')
            .select('id')
            .eq('instance_id', pairedInstanceId)
            .eq('user_id', userId)
            .eq('status', 'active')
            .maybeSingle();
          
          if (pairedSchedule) {
            // Check warming activities to see if this phone received messages from the paired instance
            const { data: sentActivity } = await supabase
              .from('warming_activities')
              .select('id')
              .eq('schedule_id', pairedSchedule.id)
              .eq('contact_phone', phone)
              .eq('activity_type', 'send_message')
              .limit(1);
            
            if (sentActivity && sentActivity.length > 0) {
              console.log(`[WARMING] Message is from paired instance (schedule: ${pairedSchedule.id})`);
              isWarmingMessage = true;
              break;
            }
          }
        }
      }
    }
    
    if (!isWarmingMessage) {
      console.log('[WARMING] Message is not from a warming source, skipping');
      return;
    }
    
    // Update warming schedule counters
    const newReceivedToday = (schedule.messages_received_today || 0) + 1;
    const newTotalReceived = (schedule.total_messages_received || 0) + 1;
    
    const { error: updateError } = await supabase
      .from('warming_schedules')
      .update({
        messages_received_today: newReceivedToday,
        total_messages_received: newTotalReceived,
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', schedule.id);
    
    if (updateError) {
      console.error('[WARMING] Error updating schedule counters:', updateError);
      return;
    }
    
    console.log(`[WARMING] Updated schedule ${schedule.id}: received_today=${newReceivedToday}, total_received=${newTotalReceived}`);
    
    // Log the activity
    const { error: activityError } = await supabase
      .from('warming_activities')
      .insert({
        schedule_id: schedule.id,
        instance_id: instanceId,
        activity_type: 'receive_message',
        contact_phone: phone,
        content_preview: contentPreview?.substring(0, 100) || '',
        success: true,
      });
    
    if (activityError) {
      console.error('[WARMING] Error logging activity:', activityError);
    } else {
      console.log(`[WARMING] Activity logged for schedule ${schedule.id}`);
    }
    
  } catch (error) {
    console.error('[WARMING] Error in checkAndCountWarmingMessage:', error);
  }
}

// deno-lint-ignore no-explicit-any
async function handleMessagesUpdate(supabase: any, data: any) {
  console.log('handleMessagesUpdate called with:', JSON.stringify(data, null, 2));
  
  // Evolution API sends data directly, not in data.messages array
  // keyId is the WhatsApp internal ID, messageId is the one we stored
  const messageId = data.messageId || data.keyId || data.key?.id;
  const statusString = data.status;

  if (!messageId || !statusString) {
    console.log('No messageId or status in update data:', { messageId, statusString });
    return;
  }

  // Map Evolution API status strings to our status
  let statusText = 'pending';
  let delivered_at: string | null = null;
  let read_at: string | null = null;
  const now = new Date().toISOString();

  // Evolution API status values:
  // "ERROR" = erro
  // "PENDING" = pendente
  // "SERVER_ACK" = servidor recebeu (enviado)
  // "DELIVERY_ACK" = entregue ao destinatário
  // "READ" = lido
  // "PLAYED" = áudio reproduzido (equivalente a lido)
  
  const statusUpper = String(statusString).toUpperCase();
  
  switch (statusUpper) {
    case 'ERROR':
      statusText = 'failed';
      break;
    case 'PENDING':
      statusText = 'pending';
      break;
    case 'SERVER_ACK':
      statusText = 'sent';
      break;
    case 'DELIVERY_ACK':
      statusText = 'delivered';
      delivered_at = now;
      break;
    case 'READ':
    case 'PLAYED':
      statusText = 'read';
      read_at = now;
      break;
    default:
      // Fallback for numeric statuses (if any)
      if (statusString === 2 || statusString === '2') statusText = 'sent';
      else if (statusString === 3 || statusString === '3') { statusText = 'delivered'; delivered_at = now; }
      else if (statusString === 4 || statusString === '4') { statusText = 'read'; read_at = now; }
      else console.log('Unknown status value:', statusString);
  }

  console.log(`Updating message ${messageId} to status ${statusText}`);

  // deno-lint-ignore no-explicit-any
  const updateData: any = { status: statusText };
  if (delivered_at) updateData.delivered_at = delivered_at;
  if (read_at) updateData.read_at = read_at;

  // Update by whatsapp_message_id
  const { data: updated, error } = await supabase
    .from('inbox_messages')
    .update(updateData)
    .eq('whatsapp_message_id', messageId)
    .select('id');

  if (error) {
    console.error('Error updating message status:', error);
  } else if (updated && updated.length > 0) {
    console.log(`Message ${messageId} updated to ${statusText} successfully`);
  } else {
    console.log(`Message ${messageId} not found in database`);
  }
}

// deno-lint-ignore no-explicit-any
async function handleConnectionUpdate(supabase: any, instanceId: string, data: any) {
  const state = data.state;
  if (!state) return;

  let status = 'disconnected';
  if (state === 'open') status = 'connected';
  else if (state === 'connecting') status = 'connecting';

  console.log(`Updating instance ${instanceId} connection status to ${status}`);

  await supabase
    .from('whatsapp_instances')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', instanceId);
}

// Update SLA metrics when first response is sent
// deno-lint-ignore no-explicit-any
async function updateSLAMetrics(supabase: any, userId: string, conversationId: string, conversationCreatedAt: string) {
  try {
    const now = new Date();
    const created = new Date(conversationCreatedAt);
    const responseTimeSeconds = Math.floor((now.getTime() - created.getTime()) / 1000);
    
    // Get today's date for metric_date
    const today = now.toISOString().split('T')[0];
    
    // Find user's organization
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('organization_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .single();
    
    const orgId = teamMember?.organization_id || null;
    
    // Check if metric exists for today
    const { data: existingMetric } = await supabase
      .from('sla_metrics')
      .select('*')
      .eq('user_id', userId)
      .eq('metric_date', today)
      .single();
    
    // Calculate SLA breaches
    const breached15min = responseTimeSeconds > 900 ? 1 : 0;
    const breached1h = responseTimeSeconds > 3600 ? 1 : 0;
    const breached24h = responseTimeSeconds > 86400 ? 1 : 0;
    
    if (existingMetric) {
      // Update existing metric
      const newTotalResponses = existingMetric.conversations_responded + 1;
      const newTotalSeconds = existingMetric.total_first_response_seconds + responseTimeSeconds;
      const newAvgSeconds = Math.floor(newTotalSeconds / newTotalResponses);
      
      await supabase
        .from('sla_metrics')
        .update({
          conversations_responded: newTotalResponses,
          total_first_response_seconds: newTotalSeconds,
          avg_first_response_seconds: newAvgSeconds,
          sla_breached_15min: existingMetric.sla_breached_15min + breached15min,
          sla_breached_1h: existingMetric.sla_breached_1h + breached1h,
          sla_breached_24h: existingMetric.sla_breached_24h + breached24h,
        })
        .eq('id', existingMetric.id);
      
      console.log(`[SLA] Updated metrics for user ${userId}: avg=${newAvgSeconds}s`);
    } else {
      // Create new metric for today
      await supabase
        .from('sla_metrics')
        .insert({
          user_id: userId,
          organization_id: orgId,
          metric_date: today,
          conversations_received: 1,
          conversations_responded: 1,
          total_first_response_seconds: responseTimeSeconds,
          avg_first_response_seconds: responseTimeSeconds,
          sla_breached_15min: breached15min,
          sla_breached_1h: breached1h,
          sla_breached_24h: breached24h,
        });
      
      console.log(`[SLA] Created metrics for user ${userId}: first_response=${responseTimeSeconds}s`);
    }
  } catch (error) {
    console.error('[SLA] Error updating SLA metrics:', error);
  }
}
