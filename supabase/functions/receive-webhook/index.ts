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

    // Extract phone from the correct JID:
    // Priority: use remoteJid if it's a real phone number (@s.whatsapp.net or @c.us)
    // Only use remoteJidAlt as fallback if remoteJid is a Label ID (@lid)
    let jidToUse = remoteJid;
    
    // Check if remoteJid is a Label ID - if so, try to use remoteJidAlt
    if (remoteJid.includes('@lid') && key.remoteJidAlt && !key.remoteJidAlt.includes('@lid')) {
      jidToUse = key.remoteJidAlt;
    }
    // If remoteJid is @lid and remoteJidAlt is also @lid or not available, 
    // check if there's a phone number in the regular format
    else if (remoteJid.includes('@lid')) {
      // Try to extract from remoteJidAlt if available and it's a real phone
      if (key.remoteJidAlt && (key.remoteJidAlt.includes('@s.whatsapp.net') || key.remoteJidAlt.includes('@c.us'))) {
        jidToUse = key.remoteJidAlt;
      } else {
        console.warn('Warning: Only Label ID available, no real phone number found');
      }
    }
    
    console.log('Using JID:', jidToUse, '(remoteJid:', remoteJid, ', remoteJidAlt:', key.remoteJidAlt, ')');
    
    let phone = jidToUse
      .replace('@s.whatsapp.net', '')
      .replace('@c.us', '')
      .replace('@lid', '');
    
    // Validate that we have a real phone number (not a Label ID)
    // Label IDs are typically longer than 15 digits
    if (phone.length > 15 || phone.length < 8) {
      console.error(`Invalid phone extracted (likely Label ID): ${phone}`);
      // Try to find the real phone from remoteJid if it wasn't a @lid
      const altPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
      if (altPhone.length >= 8 && altPhone.length <= 15) {
        phone = altPhone;
        console.log('Using phone from remoteJid instead:', phone);
      } else {
        console.error('Could not extract valid phone number, skipping message');
        continue;
      }
    }
    
    console.log('Extracted phone:', phone);

    // Get message content - support multiple formats
    const content = message?.conversation || 
                   message?.extendedTextMessage?.text || 
                   message?.imageMessage?.caption ||
                   message?.videoMessage?.caption ||
                   '';
    
    if (!content) {
      console.log('No text content found in message, skipping');
      console.log('Message structure:', JSON.stringify(message));
      continue;
    }

    const isFromMe = key.fromMe === true;
    const contactName = pushName || phone;
    
    console.log(`Processing: phone=${phone}, fromMe=${isFromMe}, content=${content.substring(0, 50)}...`);

    console.log(`Processing message from ${phone}, fromMe: ${isFromMe}, content: ${content.substring(0, 50)}...`);

    // Find or create contact
    let { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', userId)
      .eq('phone', phone)
      .single();

    if (!contact) {
      // Create new contact
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          user_id: userId,
          phone: phone,
          name: contactName,
          status: 'active',
        })
        .select('id')
        .single();

      if (contactError) {
        console.error('Error creating contact:', contactError);
        continue;
      }
      contact = newContact;
      console.log('Created new contact:', contact?.id);
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
          last_message_preview: content.substring(0, 100),
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
        last_message_preview: content.substring(0, 100),
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

    // Insert message
    // Note: direction must be 'inbound' or 'outbound' per database constraint
    const { error: msgError } = await supabase
      .from('inbox_messages')
      .insert({
        user_id: userId,
        conversation_id: conversation.id,
        content: content,
        direction: isFromMe ? 'outbound' : 'inbound',
        status: isFromMe ? 'sent' : 'received',
        message_type: 'text',
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
