import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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

serve(async (req) => {
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
      await handleMessagesUpsert(supabase, userId, instanceId, data, instance, evolutionApiUrl, evolutionApiKey);
    } else if (eventLower === 'messages.update' || eventLower === 'messages_update') {
      console.log('>>> Handling MESSAGES.UPDATE event');
      await handleMessagesUpdate(supabase, data);
    } else if (eventLower === 'connection.update' || eventLower === 'connection_update') {
      console.log('>>> Handling CONNECTION.UPDATE event');
      await handleConnectionUpdate(supabase, instanceId, data);
    } else if (eventLower === 'send.message' || eventLower === 'send_message') {
      console.log('>>> Handling SEND.MESSAGE event');
      await handleMessagesUpsert(supabase, userId, instanceId, data, instance, evolutionApiUrl, evolutionApiKey);
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
async function handleMessagesUpsert(supabase: any, userId: string, instanceId: string, data: any, instanceName: string, evolutionApiUrl: string, evolutionApiKey: string) {
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
            const binaryData = base64Decode(base64Data.base64);
            
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
    }
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
