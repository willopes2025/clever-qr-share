import { createClient } from "npm:@supabase/supabase-js@2";

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

    const { instanceName, startDate, userId } = await req.json();

    if (!instanceName || !userId) {
      return new Response(JSON.stringify({ error: 'instanceName and userId are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[SYNC] Starting sync for instance ${instanceName} from date ${startDate}`);

    // Get instance from database - search by instance_name only
    // (instance may belong to another team member in the same organization)
    const { data: instanceData, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('id, user_id, default_funnel_id')
      .eq('instance_name', instanceName)
      .single();

    if (instanceError || !instanceData) {
      console.error('[SYNC] Instance not found:', instanceError);
      return new Response(JSON.stringify({ error: 'Instance not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use the instance owner's user_id for creating contacts/conversations
    const instanceOwnerId = instanceData.user_id;

    const instanceId = instanceData.id;
    const startTimestamp = startDate ? new Date(startDate).getTime() / 1000 : 0;

    // 1. Fetch all chats from the instance
    console.log(`[SYNC] Fetching chats for instance ${instanceName}...`);
    const chatsResponse = await fetch(
      `${evolutionApiUrl}/chat/findChats/${instanceName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey,
        },
        body: JSON.stringify({}),
      }
    );

    if (!chatsResponse.ok) {
      const errorText = await chatsResponse.text();
      console.error('[SYNC] Error fetching chats:', errorText);
      return new Response(JSON.stringify({ error: 'Failed to fetch chats from Evolution API' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const chats = await chatsResponse.json();
    console.log(`[SYNC] Found ${Array.isArray(chats) ? chats.length : 0} chats`);

    if (!Array.isArray(chats) || chats.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        synced: { chats: 0, messages: 0, contacts: 0 } 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let totalMessages = 0;
    let totalContacts = 0;
    let totalConversations = 0;

    // 2. Process each chat
    for (const chat of chats) {
      const remoteJid = chat.id || chat.remoteJid;
      
      if (!remoteJid) continue;
      
      // Skip groups and status
      if (remoteJid.includes('@g.us') || remoteJid === 'status@broadcast') {
        console.log(`[SYNC] Skipping group/status: ${remoteJid}`);
        continue;
      }

      // Extract phone number
      const phone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
      
      if (!/^\d{8,15}$/.test(phone)) {
        console.log(`[SYNC] Invalid phone: ${phone}`);
        continue;
      }

      console.log(`[SYNC] Processing chat with ${phone}...`);

      // 3. Fetch messages for this chat
      try {
        const messagesResponse = await fetch(
          `${evolutionApiUrl}/chat/findMessages/${instanceName}`,
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
            }),
          }
        );

        if (!messagesResponse.ok) {
          console.error(`[SYNC] Error fetching messages for ${phone}`);
          continue;
        }

        const messagesData = await messagesResponse.json();
        const messages = messagesData.messages || messagesData || [];
        
        if (!Array.isArray(messages) || messages.length === 0) {
          console.log(`[SYNC] No messages for ${phone}`);
          continue;
        }

        // Filter messages by date
        const filteredMessages = messages.filter((msg: { messageTimestamp?: number }) => {
          const timestamp = msg.messageTimestamp || 0;
          return timestamp >= startTimestamp;
        });

        if (filteredMessages.length === 0) {
          console.log(`[SYNC] No messages after ${startDate} for ${phone}`);
          continue;
        }

        console.log(`[SYNC] Found ${filteredMessages.length} messages after ${startDate} for ${phone}`);

        // 4. Create or get contact
        let contactId: string;
        const normalizedPhone = phone.startsWith('55') ? phone : `55${phone}`;
        
        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id')
          .eq('user_id', instanceOwnerId)
          .eq('phone', normalizedPhone)
          .single();

        if (existingContact) {
          contactId = existingContact.id;
          
          // Try to update profile picture if contact doesn't have one
          const { data: contactData } = await supabase
            .from('contacts')
            .select('avatar_url')
            .eq('id', contactId)
            .single();
          
          if (!contactData?.avatar_url) {
            try {
              console.log(`[SYNC] Fetching profile picture for existing contact ${phone}...`);
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
                const avatarUrl = profileData.profilePictureUrl || profileData.picture || profileData.imgUrl || profileData.profilePicUrl;
                if (avatarUrl) {
                  await supabase
                    .from('contacts')
                    .update({ avatar_url: avatarUrl })
                    .eq('id', contactId);
                  console.log(`[SYNC] Updated avatar_url for contact ${phone}`);
                }
              }
            } catch (profileError) {
              console.error('[SYNC] Error fetching profile:', profileError);
            }
          }
        } else {
          const contactName = chat.name || chat.pushName || normalizedPhone;
          
          // Fetch profile picture for new contact
          let avatarUrl: string | null = null;
          try {
            console.log(`[SYNC] Fetching profile picture for new contact ${phone}...`);
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
                console.log(`[SYNC] Found profile picture for ${phone}`);
              }
            }
          } catch (profileError) {
            console.error('[SYNC] Error fetching profile:', profileError);
          }
          
          const { data: newContact, error: contactError } = await supabase
            .from('contacts')
            .insert({
              user_id: instanceOwnerId,
              phone: normalizedPhone,
              name: contactName,
              status: 'active',
              avatar_url: avatarUrl,
            })
            .select('id')
            .single();

          if (contactError || !newContact) {
            console.error(`[SYNC] Error creating contact for ${phone}:`, contactError);
            continue;
          }

          contactId = newContact.id;
          totalContacts++;
        }

        // 5. Create or get conversation
        let conversationId: string;
        
        const { data: existingConversation } = await supabase
          .from('conversations')
          .select('id')
          .eq('user_id', instanceOwnerId)
          .eq('contact_id', contactId)
          .eq('instance_id', instanceId)
          .single();

        if (existingConversation) {
          conversationId = existingConversation.id;
        } else {
          const { data: newConversation, error: convError } = await supabase
            .from('conversations')
            .insert({
              user_id: instanceOwnerId,
              contact_id: contactId,
              instance_id: instanceId,
              status: 'active',
            })
            .select('id')
            .single();

          if (convError || !newConversation) {
            console.error(`[SYNC] Error creating conversation:`, convError);
            continue;
          }

          conversationId = newConversation.id;
          totalConversations++;
        }

        // 6. Insert messages (avoiding duplicates)
        for (const msg of filteredMessages) {
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
            console.log(`[SYNC] Message ${whatsappMessageId} already exists, skipping`);
            continue;
          }

          // Determine direction
          const isFromMe = key?.fromMe === true;
          const direction = isFromMe ? 'outbound' : 'inbound';

          // Extract content
          let content = '';
          let messageType = 'text';

          if (message?.conversation) {
            content = message.conversation;
          } else if (message?.extendedTextMessage?.text) {
            content = message.extendedTextMessage.text;
          } else if (message?.imageMessage) {
            messageType = 'image';
            content = message.imageMessage.caption || '📷 Imagem';
          } else if (message?.audioMessage) {
            messageType = message.audioMessage.ptt ? 'voice' : 'audio';
            content = '🎵 Áudio';
          } else if (message?.videoMessage) {
            messageType = 'video';
            content = message.videoMessage.caption || '🎬 Vídeo';
          } else if (message?.documentMessage) {
            messageType = 'document';
            content = message.documentMessage.fileName || '📄 Documento';
          } else if (message?.stickerMessage) {
            messageType = 'sticker';
            content = '🎭 Sticker';
          } else {
            // Skip unknown message types
            continue;
          }

          const timestamp = msg.messageTimestamp 
            ? new Date(msg.messageTimestamp * 1000).toISOString()
            : new Date().toISOString();

          const { error: insertError } = await supabase
            .from('inbox_messages')
            .insert({
              conversation_id: conversationId,
              user_id: instanceOwnerId,
              direction,
              content,
              message_type: messageType,
              status: direction === 'inbound' ? 'received' : 'sent',
              whatsapp_message_id: whatsappMessageId,
              sent_at: timestamp,
              created_at: timestamp,
            });

          if (insertError) {
            console.error(`[SYNC] Error inserting message:`, insertError);
          } else {
            totalMessages++;
          }
        }

        // 7. Update conversation with last message
        const lastMsg = filteredMessages[filteredMessages.length - 1];
        let lastContent = '';
        const lastMessage = lastMsg?.message;
        
        if (lastMessage?.conversation) {
          lastContent = lastMessage.conversation;
        } else if (lastMessage?.extendedTextMessage?.text) {
          lastContent = lastMessage.extendedTextMessage.text;
        } else if (lastMessage?.imageMessage) {
          lastContent = '📷 Imagem';
        } else if (lastMessage?.audioMessage) {
          lastContent = '🎵 Áudio';
        } else if (lastMessage?.videoMessage) {
          lastContent = '🎬 Vídeo';
        } else if (lastMessage?.documentMessage) {
          lastContent = '📄 Documento';
        }

        const lastTimestamp = lastMsg?.messageTimestamp 
          ? new Date(lastMsg.messageTimestamp * 1000).toISOString()
          : new Date().toISOString();

        await supabase
          .from('conversations')
          .update({
            last_message_at: lastTimestamp,
            last_message_preview: lastContent.substring(0, 100),
          })
          .eq('id', conversationId);

      } catch (chatError) {
        console.error(`[SYNC] Error processing chat ${phone}:`, chatError);
        continue;
      }
    }

    console.log(`[SYNC] Completed! Synced ${totalMessages} messages, ${totalContacts} new contacts, ${totalConversations} new conversations`);

    return new Response(JSON.stringify({ 
      success: true, 
      synced: { 
        chats: chats.length,
        messages: totalMessages, 
        contacts: totalContacts,
        conversations: totalConversations,
      } 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[SYNC] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
