import { createClient } from "npm:@supabase/supabase-js@2.84.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!;
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { conversationId, limit = 50 } = await req.json();

    if (!conversationId) {
      return new Response(JSON.stringify({ error: 'conversationId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[SYNC-SINGLE] Starting sync for conversation ${conversationId}`);

    // Get conversation with contact and instance info
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        user_id,
        instance_id,
        contact:contacts(id, phone, name),
        instance:whatsapp_instances(id, instance_name, evolution_instance_name)
      `)
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      console.error('[SYNC-SINGLE] Conversation not found:', convError);
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contactData = conversation.contact as unknown;
    const instanceData = conversation.instance as unknown;
    
    const contact = (Array.isArray(contactData) ? contactData[0] : contactData) as { id: string; phone: string; name: string } | null;
    const instance = (Array.isArray(instanceData) ? instanceData[0] : instanceData) as { id: string; instance_name: string; evolution_instance_name: string } | null;

    if (!contact || !instance) {
      return new Response(JSON.stringify({ error: 'Contact or instance not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const phone = contact.phone.replace(/\D/g, '');
    const remoteJid = `${phone}@s.whatsapp.net`;
    const evolutionName = instance.evolution_instance_name || instance.instance_name;

    console.log(`[SYNC-SINGLE] Fetching messages for ${phone} from instance ${evolutionName}`);

    // Fetch messages directly for this contact using findMessages
    const messagesResponse = await fetch(
      `${evolutionApiUrl}/chat/findMessages/${encodeURIComponent(evolutionName)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey,
        },
        body: JSON.stringify({
          where: {
            key: {
              remoteJid: remoteJid,
            },
          },
          limit: limit,
        }),
      }
    );

    if (!messagesResponse.ok) {
      const errorText = await messagesResponse.text();
      console.error('[SYNC-SINGLE] Error fetching messages:', messagesResponse.status, errorText);
      return new Response(JSON.stringify({ error: 'Failed to fetch messages from WhatsApp', details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const messagesData = await messagesResponse.json();
    const messages = messagesData.messages || messagesData || [];

    console.log(`[SYNC-SINGLE] Found ${Array.isArray(messages) ? messages.length : 0} messages`);

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        synced: 0,
        message: 'No messages found for this contact'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let totalSynced = 0;
    let lastMessageAt: string | null = null;
    let lastMessagePreview: string | null = null;

    // Process each message
    for (const msg of messages) {
      const key = msg.key;
      const message = msg.message;
      const whatsappMessageId = key?.id;

      if (!whatsappMessageId) continue;

      // Check if message already exists
      const { data: existingMsg } = await supabase
        .from('inbox_messages')
        .select('id')
        .eq('whatsapp_message_id', whatsappMessageId)
        .single();

      if (existingMsg) {
        console.log(`[SYNC-SINGLE] Message ${whatsappMessageId} already exists, skipping`);
        continue;
      }

      // Determine direction
      const isFromMe = key?.fromMe === true;
      const direction = isFromMe ? 'outbound' : 'inbound';

      // Extract content and type
      let content = '';
      let messageType = 'text';
      let mediaUrl: string | null = null;

      if (message?.conversation) {
        content = message.conversation;
      } else if (message?.extendedTextMessage?.text) {
        content = message.extendedTextMessage.text;
      } else if (message?.imageMessage) {
        messageType = 'image';
        content = message.imageMessage.caption || '📷 Imagem';
        mediaUrl = message.imageMessage.url || null;
      } else if (message?.audioMessage) {
        messageType = message.audioMessage.ptt ? 'voice' : 'audio';
        content = '🎵 Áudio';
        mediaUrl = message.audioMessage.url || null;
      } else if (message?.videoMessage) {
        messageType = 'video';
        content = message.videoMessage.caption || '🎬 Vídeo';
        mediaUrl = message.videoMessage.url || null;
      } else if (message?.documentMessage) {
        messageType = 'document';
        content = message.documentMessage.fileName || '📄 Documento';
        mediaUrl = message.documentMessage.url || null;
      } else if (message?.stickerMessage) {
        messageType = 'sticker';
        content = '🎭 Sticker';
        mediaUrl = message.stickerMessage.url || null;
      } else {
        // Skip unknown message types
        console.log(`[SYNC-SINGLE] Unknown message type, skipping`);
        continue;
      }

      const timestamp = msg.messageTimestamp 
        ? new Date(msg.messageTimestamp * 1000).toISOString()
        : new Date().toISOString();

      // Try to download and persist media if available
      let persistedMediaUrl: string | null = null;
      if (mediaUrl && messageType !== 'text') {
        try {
          console.log(`[SYNC-SINGLE] Downloading media for message ${whatsappMessageId}...`);
          const base64Response = await fetch(
            `${evolutionApiUrl}/chat/getBase64FromMediaMessage/${encodeURIComponent(evolutionName)}`,
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
            if (base64Data.base64) {
              const mimeType = base64Data.mimetype || 'application/octet-stream';
              const ext = getExtension(messageType, mimeType);
              const fileName = `${Date.now()}-${whatsappMessageId}.${ext}`;
              const filePath = `${conversation.user_id}/${fileName}`;

              const binaryData = Uint8Array.from(atob(base64Data.base64), c => c.charCodeAt(0));

              const { error: uploadError } = await supabase
                .storage
                .from('inbox-media')
                .upload(filePath, binaryData, {
                  contentType: mimeType,
                  upsert: true,
                });

              if (!uploadError) {
                const { data: publicUrlData } = supabase
                  .storage
                  .from('inbox-media')
                  .getPublicUrl(filePath);
                persistedMediaUrl = publicUrlData.publicUrl;
                console.log(`[SYNC-SINGLE] Media saved: ${persistedMediaUrl}`);
              }
            }
          }
        } catch (mediaError) {
          console.error('[SYNC-SINGLE] Error downloading media:', mediaError);
        }
      }

      const { error: insertError } = await supabase
        .from('inbox_messages')
        .insert({
          conversation_id: conversationId,
          user_id: conversation.user_id,
          direction,
          content,
          message_type: messageType,
          media_url: persistedMediaUrl,
          status: direction === 'inbound' ? 'received' : 'sent',
          whatsapp_message_id: whatsappMessageId,
          sent_at: timestamp,
          created_at: timestamp,
        });

      if (insertError) {
        console.error(`[SYNC-SINGLE] Error inserting message:`, insertError);
      } else {
        totalSynced++;
        // Track last message for conversation update
        if (!lastMessageAt || timestamp > lastMessageAt) {
          lastMessageAt = timestamp;
          lastMessagePreview = content.substring(0, 100);
        }
      }
    }

    // Update conversation with last message info
    if (lastMessageAt) {
      await supabase
        .from('conversations')
        .update({
          last_message_at: lastMessageAt,
          last_message_preview: lastMessagePreview,
        })
        .eq('id', conversationId);
    }

    console.log(`[SYNC-SINGLE] Completed! Synced ${totalSynced} messages`);

    return new Response(JSON.stringify({ 
      success: true, 
      synced: totalSynced,
      conversationId,
      phone,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[SYNC-SINGLE] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function getExtension(messageType: string, mimeType: string): string {
  if (messageType === 'voice' || messageType === 'audio') return 'mp4';
  if (messageType === 'video') return 'mp4';
  if (messageType === 'image') {
    if (mimeType.includes('png')) return 'png';
    if (mimeType.includes('gif')) return 'gif';
    if (mimeType.includes('webp')) return 'webp';
    return 'jpg';
  }
  if (messageType === 'document') {
    if (mimeType.includes('pdf')) return 'pdf';
    return 'bin';
  }
  if (messageType === 'sticker') return 'webp';
  return 'bin';
}
