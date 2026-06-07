import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatLike {
  id?: string;
  remoteJid?: string;
  name?: string;
  pushName?: string;
}

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

    const { data: instanceData, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('id, user_id, default_funnel_id, evolution_instance_name')
      .eq('instance_name', instanceName)
      .single();

    if (instanceError || !instanceData) {
      console.error('[SYNC] Instance not found:', instanceError);
      return new Response(JSON.stringify({ error: 'Instance not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const instanceOwnerId = instanceData.user_id;
    const instanceId = instanceData.id;
    const startTimestamp = startDate ? new Date(startDate).getTime() / 1000 : 0;
    const evolutionName = instanceData.evolution_instance_name || instanceName;
    console.log(`[SYNC] Using Evolution API name: ${evolutionName} (display name: ${instanceName})`);

    // ============= STEP 1: Build chat list with fallbacks =============
    let chats: ChatLike[] = [];
    let chatsSource = 'findChats';
    let evolutionWarning: string | null = null;

    // Attempt A: findChats (primary)
    try {
      console.log(`[SYNC] [A] Trying findChats for ${evolutionName}...`);
      const chatsResponse = await fetch(
        `${evolutionApiUrl}/chat/findChats/${evolutionName}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
          body: JSON.stringify({}),
        }
      );

      if (chatsResponse.ok) {
        const data = await chatsResponse.json();
        if (Array.isArray(data)) chats = data as ChatLike[];
      } else {
        const errorText = await chatsResponse.text();
        console.error('[SYNC] [A] findChats failed:', errorText);
        evolutionWarning = `findChats falhou: ${errorText.substring(0, 200)}`;
      }
    } catch (e) {
      console.error('[SYNC] [A] findChats threw:', e);
      evolutionWarning = `findChats threw: ${e instanceof Error ? e.message : String(e)}`;
    }

    // Attempt B: findContacts (fallback when findChats fails)
    if (chats.length === 0) {
      try {
        console.log(`[SYNC] [B] Trying findContacts fallback for ${evolutionName}...`);
        const contactsResponse = await fetch(
          `${evolutionApiUrl}/chat/findContacts/${evolutionName}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
            body: JSON.stringify({}),
          }
        );
        if (contactsResponse.ok) {
          const data = await contactsResponse.json();
          if (Array.isArray(data)) {
            chats = (data as ChatLike[]).map((c) => ({
              id: c.id || c.remoteJid,
              remoteJid: c.id || c.remoteJid,
              name: c.pushName || c.name,
            }));
            chatsSource = 'findContacts';
            console.log(`[SYNC] [B] findContacts returned ${chats.length} entries`);
          }
        } else {
          const errorText = await contactsResponse.text();
          console.error('[SYNC] [B] findContacts failed:', errorText);
        }
      } catch (e) {
        console.error('[SYNC] [B] findContacts threw:', e);
      }
    }

    // Attempt C: existing DB contacts as fallback
    if (chats.length === 0) {
      console.log(`[SYNC] [C] Falling back to existing DB contacts for org of ${instanceOwnerId}...`);
      const { data: orgMemberIds } = await supabase
        .rpc('get_organization_member_ids', { _user_id: instanceOwnerId });
      const memberIdList: string[] = Array.isArray(orgMemberIds)
        ? (orgMemberIds as Array<{ get_organization_member_ids?: string } | string>).map((r) =>
            typeof r === 'string' ? r : r.get_organization_member_ids ?? ''
          ).filter(Boolean)
        : [instanceOwnerId];

      const { data: dbContacts } = await supabase
        .from('contacts')
        .select('id, phone, name')
        .in('user_id', memberIdList.length ? memberIdList : [instanceOwnerId])
        .not('phone', 'is', null)
        .limit(2000);

      if (dbContacts && dbContacts.length > 0) {
        chats = dbContacts.map((c) => {
          const phone = String(c.phone).replace(/\D/g, '');
          return {
            id: `${phone}@s.whatsapp.net`,
            remoteJid: `${phone}@s.whatsapp.net`,
            name: c.name || undefined,
          };
        });
        chatsSource = 'db-contacts';
        console.log(`[SYNC] [C] Reconstructed ${chats.length} chats from DB contacts`);
      }
    }

    if (chats.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        evolutionError: evolutionWarning ||
          'Não foi possível listar conversas da instância. A Evolution API retornou erro interno e não há contatos no banco para tentar individualmente. Tente reconectar a instância (logout + novo QR Code) e tentar novamente em alguns minutos.',
        synced: { chats: 0, messages: 0, contacts: 0, conversations: 0 },
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[SYNC] Using ${chats.length} chats (source: ${chatsSource})`);

    let totalMessages = 0;
    let totalContacts = 0;
    let totalConversations = 0;
    let chatsWithErrors = 0;
    let chatsSkippedJid = 0;
    let chatsSkippedGroup = 0;
    let chatsSkippedRegex = 0;
    let chatsProcessed = 0;
    let sampleLogged = false;

    for (const chat of chats) {
      const remoteJid = chat.id || chat.remoteJid;
      if (!remoteJid) { chatsSkippedJid++; continue; }
      if (remoteJid.includes('@g.us') || remoteJid === 'status@broadcast') { chatsSkippedGroup++; continue; }

      const phone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace('@lid', '');
      if (!/^\d{8,15}$/.test(phone)) { chatsSkippedRegex++; continue; }
      chatsProcessed++;

      try {
        const messagesResponse = await fetch(
          `${evolutionApiUrl}/chat/findMessages/${evolutionName}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
            body: JSON.stringify({ where: { key: { remoteJid } } }),
          }
        );

        if (!messagesResponse.ok) {
          chatsWithErrors++;
          if (!sampleLogged) {
            const errTxt = await messagesResponse.text();
            console.error(`[SYNC] findMessages ${phone} status=${messagesResponse.status} body=${errTxt.substring(0, 400)}`);
            sampleLogged = true;
          }
          continue;
        }

        const messagesData = await messagesResponse.json();
        // Evolution responses vary by version:
        //   - older: array directly, or { messages: [...] }
        //   - newer: { messages: { records: [...], total, currentPage, ... } }
        let messages: any[] = [];
        if (Array.isArray(messagesData)) {
          messages = messagesData;
        } else if (Array.isArray(messagesData?.messages)) {
          messages = messagesData.messages;
        } else if (Array.isArray(messagesData?.messages?.records)) {
          messages = messagesData.messages.records;
        } else if (Array.isArray(messagesData?.records)) {
          messages = messagesData.records;
        }

        if (messages.length === 0) {
          console.log(`[SYNC] No messages for ${phone}. Sample keys=${Object.keys(messagesData || {}).join(',')}`);
          continue;
        }

        const filteredMessages = messages.filter((msg: { messageTimestamp?: number }) => {
          const timestamp = msg.messageTimestamp || 0;
          return timestamp >= startTimestamp;
        });

        console.log(`[SYNC] ${phone}: total=${messages.length} after-date=${filteredMessages.length}`);
        if (filteredMessages.length === 0) continue;

        // Contact
        let contactId: string;
        const normalizedPhone = phone.startsWith('55') ? phone : `55${phone}`;

        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id')
          .eq('user_id', instanceOwnerId)
          .eq('phone', normalizedPhone)
          .maybeSingle();

        if (existingContact) {
          contactId = existingContact.id;
        } else {
          const isValidContactName = (name: string | undefined | null): boolean => {
            if (!name || name.trim().length < 2) return false;
            if (name.startsWith('LID_')) return false;
            if (/^\d+$/.test(name)) return false;
            if (/^55\d{10,11}$/.test(name)) return false;
            return true;
          };
          const rawName = chat.name || chat.pushName;
          const contactName = isValidContactName(rawName) ? rawName! : 'Cliente';

          const { data: newContact, error: contactError } = await supabase
            .from('contacts')
            .insert({
              user_id: instanceOwnerId,
              phone: normalizedPhone,
              name: contactName,
              status: 'active',
            })
            .select('id')
            .single();

          if (contactError || !newContact) {
            chatsWithErrors++;
            continue;
          }
          contactId = newContact.id;
          totalContacts++;
        }

        // Conversation
        let conversationId: string;
        const { data: existingConversation } = await supabase
          .from('conversations')
          .select('id')
          .eq('user_id', instanceOwnerId)
          .eq('contact_id', contactId)
          .eq('instance_id', instanceId)
          .maybeSingle();

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
            chatsWithErrors++;
            continue;
          }
          conversationId = newConversation.id;
          totalConversations++;
        }

        // Insert messages
        for (const msg of filteredMessages) {
          const key = msg.key;
          const message = msg.message;
          const whatsappMessageId = key?.id;
          if (!whatsappMessageId) continue;

          const { data: existingMsg } = await supabase
            .from('inbox_messages')
            .select('id')
            .eq('whatsapp_message_id', whatsappMessageId)
            .maybeSingle();

          if (existingMsg) continue;

          const isFromMe = key?.fromMe === true;
          const direction = isFromMe ? 'outbound' : 'inbound';

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

          if (!insertError) totalMessages++;
        }

        // Update conversation last message
        const lastMsg = filteredMessages[filteredMessages.length - 1];
        const lastTimestamp = lastMsg?.messageTimestamp
          ? new Date(lastMsg.messageTimestamp * 1000).toISOString()
          : new Date().toISOString();
        const lm = lastMsg?.message;
        let lastContent = '';
        if (lm?.conversation) lastContent = lm.conversation;
        else if (lm?.extendedTextMessage?.text) lastContent = lm.extendedTextMessage.text;
        else if (lm?.imageMessage) lastContent = '📷 Imagem';
        else if (lm?.audioMessage) lastContent = '🎵 Áudio';
        else if (lm?.videoMessage) lastContent = '🎬 Vídeo';
        else if (lm?.documentMessage) lastContent = '📄 Documento';

        await supabase
          .from('conversations')
          .update({
            last_message_at: lastTimestamp,
            last_message_preview: lastContent.substring(0, 100),
          })
          .eq('id', conversationId);
      } catch (chatError) {
        chatsWithErrors++;
        console.error(`[SYNC] Error processing chat ${phone}:`, chatError);
        continue;
      }
    }

    console.log(`[SYNC] Done. messages=${totalMessages} contacts=${totalContacts} conv=${totalConversations} errors=${chatsWithErrors} source=${chatsSource}`);

    return new Response(JSON.stringify({
      success: true,
      source: chatsSource,
      evolutionWarning,
      synced: {
        chats: chats.length,
        messages: totalMessages,
        contacts: totalContacts,
        conversations: totalConversations,
        chatsWithErrors,
      },
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
