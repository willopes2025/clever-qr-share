import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Use service role to bypass RLS
    // deno-lint-ignore no-explicit-any
    const supabase = createClient(supabaseUrl, supabaseServiceKey) as any;

    const payload = await req.json();
    
    // Enhanced logging
    console.log('=== WEBHOOK RECEIVED ===');
    console.log('Full payload:', JSON.stringify(payload, null, 2));

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

    // Get instance from database to find user_id
    const { data: instanceData, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('id, user_id')
      .eq('instance_name', instance)
      .single();

    if (instanceError || !instanceData) {
      console.error('Instance not found:', instance, instanceError);
      return new Response(JSON.stringify({ success: false, error: 'Instance not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = instanceData.user_id;
    const instanceId = instanceData.id;

    console.log(`Processing event ${event} for instance ${instance} (user: ${userId})`);

    // Handle different event types - check multiple formats
    const eventLower = event?.toLowerCase() || '';
    
    if (eventLower === 'messages.upsert' || eventLower === 'messages_upsert') {
      console.log('>>> Handling MESSAGES.UPSERT event');
      await handleMessagesUpsert(supabase, userId, instanceId, data);
    } else if (eventLower === 'messages.update' || eventLower === 'messages_update') {
      console.log('>>> Handling MESSAGES.UPDATE event');
      await handleMessagesUpdate(supabase, data);
    } else if (eventLower === 'connection.update' || eventLower === 'connection_update') {
      console.log('>>> Handling CONNECTION.UPDATE event');
      await handleConnectionUpdate(supabase, instanceId, data);
    } else if (eventLower === 'send.message' || eventLower === 'send_message') {
      console.log('>>> Handling SEND.MESSAGE event');
      await handleMessagesUpsert(supabase, userId, instanceId, data);
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

// deno-lint-ignore no-explicit-any
async function handleMessagesUpsert(supabase: any, userId: string, instanceId: string, data: any) {
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
    
    // Determine if remoteJid is a Label ID
    if (remoteJid.includes('@lid')) {
      labelId = extractPhone(remoteJid);
      console.log('Detected Label ID:', labelId);
      
      // Try to get real phone from remoteJidAlt
      if (key.remoteJidAlt && (key.remoteJidAlt.includes('@s.whatsapp.net') || key.remoteJidAlt.includes('@c.us'))) {
        phone = extractPhone(key.remoteJidAlt);
        console.log('Extracted real phone from remoteJidAlt:', phone);
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
    
    // Validate phone
    if (!isValidPhone(phone)) {
      console.error(`Invalid phone extracted: ${phone}, labelId: ${labelId}`);
      console.error('Could not extract valid phone number, skipping message');
      continue;
    }
    
    console.log(`Extracted phone: ${phone}, labelId: ${labelId}`);

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
      content = message.documentMessage.fileName || 'Documento';
      console.log('Detected DOCUMENT message, fileName:', content, 'url:', mediaUrl);
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

    const isFromMe = key.fromMe === true;
    const contactName = pushName || phone;
    
    console.log(`Processing: phone=${phone}, labelId=${labelId}, fromMe=${isFromMe}, type=${messageType}, hasMedia=${!!mediaUrl}, content=${content.substring(0, 50)}...`);

    // Find contact by phone OR by label_id (to prevent duplicates)
    let { data: contact } = await supabase
      .from('contacts')
      .select('id, label_id')
      .eq('user_id', userId)
      .eq('phone', phone)
      .single();

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
        // Update the contact's phone if it was a Label ID
        if (contactByLabel.phone !== phone) {
          console.log(`Updating contact phone from ${contactByLabel.phone} to ${phone}`);
          await supabase
            .from('contacts')
            .update({ phone: phone })
            .eq('id', contactByLabel.id);
        }
        contact = contactByLabel;
      }
    }

    if (!contact) {
      // Create new contact with label_id if available
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          user_id: userId,
          phone: phone,
          name: contactName,
          status: 'active',
          label_id: labelId,
        })
        .select('id')
        .single();

      if (contactError) {
        console.error('Error creating contact:', contactError);
        continue;
      }
      contact = newContact;
      console.log('Created new contact:', contact?.id, 'with label_id:', labelId);
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

    // Find or create conversation
    let { data: conversation } = await supabase
      .from('conversations')
      .select('id, unread_count')
      .eq('user_id', userId)
      .eq('contact_id', contact.id)
      .single();

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
      // Create new conversation
      const { data: newConversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          user_id: userId,
          contact_id: contact.id,
          instance_id: instanceId,
          status: 'active',
          unread_count: isFromMe ? 0 : 1,
          last_message_at: new Date().toISOString(),
          last_message_preview: preview,
        })
        .select('id')
        .single();

      if (convError) {
        console.error('Error creating conversation:', convError);
        continue;
      }
      conversation = newConversation;
      console.log('Created new conversation:', conversation?.id);
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

      await supabase
        .from('conversations')
        .update(updateData)
        .eq('id', conversation.id);
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
        content: content || (mediaUrl ? preview : ''),
        direction: isFromMe ? 'outbound' : 'inbound',
        status: isFromMe ? 'sent' : 'received',
        message_type: messageType,
        media_url: mediaUrl,
        whatsapp_message_id: key.id,
        sent_at: messageTimestamp ? new Date(messageTimestamp * 1000).toISOString() : new Date().toISOString(),
      });

    if (msgError) {
      console.error('Error inserting message:', msgError);
    } else {
      console.log('Message inserted successfully');
    }
  }
}

// deno-lint-ignore no-explicit-any
async function handleMessagesUpdate(supabase: any, data: any) {
  const updates = data.messages || [];
  
  for (const update of updates) {
    const messageId = update.key?.id;
    const status = update.update?.status;

    if (!messageId || status === undefined) continue;

    // Status codes: 1 = pending, 2 = sent, 3 = delivered, 4 = read
    let statusText = 'pending';
    if (status === 2) statusText = 'sent';
    else if (status === 3) statusText = 'delivered';
    else if (status === 4) statusText = 'read';

    console.log(`Updating message ${messageId} to status ${statusText}`);

    // deno-lint-ignore no-explicit-any
    const updateData: any = { status: statusText };
    if (status === 3) updateData.delivered_at = new Date().toISOString();
    if (status === 4) updateData.read_at = new Date().toISOString();

    await supabase
      .from('inbox_messages')
      .update(updateData)
      .eq('whatsapp_message_id', messageId);
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
