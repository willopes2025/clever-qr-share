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

const BATCH_SIZE = 25;
const LEASE_SECONDS = 180;

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!;
const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;

const admin = () => createClient(supabaseUrl, supabaseServiceKey);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Kick the next batch as a separate invocation so no single request runs long.
async function invokeNextBatch(jobId: string) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/sync-message-history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ action: 'process', jobId }),
    });
  } catch (e) {
    console.error('[SYNC] Failed to chain next batch:', e);
  }
}

// ============= Build chat list with fallbacks =============
async function buildChatList(evolutionName: string, instanceOwnerId: string) {
  let chats: ChatLike[] = [];
  let chatsSource = 'findChats';
  let evolutionWarning: string | null = null;
  const db = admin();

  try {
    const chatsResponse = await fetch(`${evolutionApiUrl}/chat/findChats/${evolutionName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
      body: JSON.stringify({}),
    });
    if (chatsResponse.ok) {
      const data = await chatsResponse.json();
      if (Array.isArray(data)) chats = data as ChatLike[];
    } else {
      const errorText = await chatsResponse.text();
      console.error('[SYNC] findChats failed:', errorText);
      evolutionWarning = `findChats falhou: ${errorText.substring(0, 200)}`;
    }
  } catch (e) {
    console.error('[SYNC] findChats threw:', e);
    evolutionWarning = `findChats threw: ${e instanceof Error ? e.message : String(e)}`;
  }

  if (chats.length === 0) {
    try {
      const contactsResponse = await fetch(`${evolutionApiUrl}/chat/findContacts/${evolutionName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
        body: JSON.stringify({}),
      });
      if (contactsResponse.ok) {
        const data = await contactsResponse.json();
        if (Array.isArray(data)) {
          chats = (data as Array<Record<string, unknown>>)
            .map((c) => {
              const candidates = [c.remoteJid, c.owner, c.wuid, c.jid, c.id]
                .filter((v): v is string => typeof v === 'string');
              const jid = candidates.find((v) => v.includes('@')) || '';
              return { id: jid, remoteJid: jid, name: (c.pushName as string) || (c.name as string) || undefined };
            })
            .filter((c) => !!c.remoteJid);
          chatsSource = 'findContacts';
        }
      } else {
        console.error('[SYNC] findContacts failed:', await contactsResponse.text());
      }
    } catch (e) {
      console.error('[SYNC] findContacts threw:', e);
    }
  }

  if (chats.length === 0) {
    const { data: orgMemberIds } = await db.rpc('get_organization_member_ids', { _user_id: instanceOwnerId });
    const memberIdList: string[] = Array.isArray(orgMemberIds)
      ? (orgMemberIds as Array<{ get_organization_member_ids?: string } | string>)
          .map((r) => (typeof r === 'string' ? r : r.get_organization_member_ids ?? ''))
          .filter(Boolean)
      : [instanceOwnerId];

    const { data: dbContacts } = await db
      .from('contacts')
      .select('id, phone, name')
      .in('user_id', memberIdList.length ? memberIdList : [instanceOwnerId])
      .not('phone', 'is', null)
      .limit(2000);

    if (dbContacts && dbContacts.length > 0) {
      chats = dbContacts.map((c) => {
        const phone = String(c.phone).replace(/\D/g, '');
        return { id: `${phone}@s.whatsapp.net`, remoteJid: `${phone}@s.whatsapp.net`, name: c.name || undefined };
      });
      chatsSource = 'db-contacts';
    }
  }

  // Keep only real 1:1 chats — filtering here keeps the stored total honest.
  const filtered = chats.filter((chat) => {
    const jid = chat.id || chat.remoteJid;
    if (!jid) return false;
    if (jid.includes('@g.us') || jid === 'status@broadcast') return false;
    const phone = jid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace('@lid', '');
    return /^\d{8,15}$/.test(phone);
  });

  return { chats: filtered, chatsSource, evolutionWarning };
}

function extractContent(message: Record<string, any> | undefined) {
  if (!message) return null;
  if (message.conversation) return { content: message.conversation as string, type: 'text' };
  if (message.extendedTextMessage?.text) return { content: message.extendedTextMessage.text as string, type: 'text' };
  if (message.imageMessage) return { content: (message.imageMessage.caption as string) || '📷 Imagem', type: 'image' };
  if (message.audioMessage) return { content: '🎵 Áudio', type: message.audioMessage.ptt ? 'voice' : 'audio' };
  if (message.videoMessage) return { content: (message.videoMessage.caption as string) || '🎬 Vídeo', type: 'video' };
  if (message.documentMessage) return { content: (message.documentMessage.fileName as string) || '📄 Documento', type: 'document' };
  if (message.stickerMessage) return { content: '🎭 Sticker', type: 'sticker' };
  return null;
}

const isValidContactName = (name: string | undefined | null): boolean => {
  if (!name || name.trim().length < 2) return false;
  if (name.startsWith('LID_')) return false;
  if (/^\d+$/.test(name)) return false;
  if (/^55\d{10,11}$/.test(name)) return false;
  return true;
};

// ============= Process one bounded batch of chats =============
async function processBatch(jobId: string) {
  const db = admin();

  // Single-flight lease via atomic DB function (returns the next slice of chats).
  const { data: leased, error: leaseError } = await db.rpc('lease_message_sync_job', {
    _job_id: jobId,
    _lease_seconds: LEASE_SECONDS,
    _batch_size: BATCH_SIZE,
  });

  if (leaseError) {
    console.error(`[SYNC] Lease error for job ${jobId}:`, leaseError);
    return;
  }

  if (!leased) {
    console.log(`[SYNC] Job ${jobId} not leasable (finished or already running)`);
    return;
  }

  const job = leased as Record<string, any>;
  const totalChats: number = job.total_in_chats ?? job.total_chats ?? 0;
  const offset: number = job.processed_chats ?? 0;
  const slice: ChatLike[] = Array.isArray(job.chats_slice) ? job.chats_slice : [];

  if (slice.length === 0) {
    await db.from('message_sync_jobs').update({
      status: 'completed', finished_at: new Date().toISOString(), lease_until: null,
    }).eq('id', jobId);
    return;
  }

  const instanceOwnerId: string = job.user_id;
  const instanceId: string = job.instance_id;
  const evolutionName: string = job.evolution_instance_name || job.instance_name;
  const startTimestamp = job.start_date ? new Date(job.start_date).getTime() / 1000 : 0;


  let messagesImported = 0;
  let contactsCreated = 0;
  let conversationsCreated = 0;
  let chatsWithErrors = 0;

  try {
    // Pre-load existing contacts for this batch in one query.
    const phones = slice.map((chat) => {
      const jid = (chat.id || chat.remoteJid)!;
      const raw = jid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace('@lid', '');
      return raw.startsWith('55') ? raw : `55${raw}`;
    });

    const { data: existingContacts } = await db
      .from('contacts')
      .select('id, phone')
      .eq('user_id', instanceOwnerId)
      .in('phone', phones);
    const contactByPhone = new Map<string, string>((existingContacts ?? []).map((c) => [c.phone as string, c.id as string]));

    const { data: existingConvs } = await db
      .from('conversations')
      .select('id, contact_id')
      .eq('user_id', instanceOwnerId)
      .eq('instance_id', instanceId)
      .in('contact_id', Array.from(contactByPhone.values()).length ? Array.from(contactByPhone.values()) : ['00000000-0000-0000-0000-000000000000']);
    const convByContact = new Map<string, string>((existingConvs ?? []).map((c) => [c.contact_id as string, c.id as string]));

    for (let i = 0; i < slice.length; i++) {
      const chat = slice[i];
      const remoteJid = (chat.id || chat.remoteJid)!;
      const normalizedPhone = phones[i];

      try {
        const messagesResponse = await fetch(`${evolutionApiUrl}/chat/findMessages/${evolutionName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
          body: JSON.stringify({ where: { key: { remoteJid } } }),
        });

        if (!messagesResponse.ok) {
          chatsWithErrors++;
          continue;
        }

        const messagesData = await messagesResponse.json();
        let messages: any[] = [];
        if (Array.isArray(messagesData)) messages = messagesData;
        else if (Array.isArray(messagesData?.messages)) messages = messagesData.messages;
        else if (Array.isArray(messagesData?.messages?.records)) messages = messagesData.messages.records;
        else if (Array.isArray(messagesData?.records)) messages = messagesData.records;

        const filteredMessages = messages.filter((msg: { messageTimestamp?: number }) => (msg.messageTimestamp || 0) >= startTimestamp);
        if (filteredMessages.length === 0) continue;

        // Resolve the REAL phone for @lid chats using remoteJidAlt present in the messages.
        // Without this, LID chats create junk contacts like "55" + <label id>.
        let contactPhone = normalizedPhone;
        let labelId: string | null = null;
        if (remoteJid.includes('@lid')) {
          labelId = remoteJid.replace('@lid', '');
          let resolved: string | null = null;
          for (const msg of filteredMessages as any[]) {
            const alt: string | undefined = msg?.key?.remoteJidAlt || msg?.remoteJidAlt;
            if (!alt || !(alt.includes('@s.whatsapp.net') || alt.includes('@c.us'))) continue;
            const raw = alt.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '');
            const candidate = raw.startsWith('55') ? raw : `55${raw}`;
            if (/^\d{12,13}$/.test(candidate)) { resolved = candidate; break; }
          }
          if (resolved) {
            contactPhone = resolved;
          } else {
            // Never fabricate a phone from a label id.
            contactPhone = `LID_${labelId}`;
          }
        }

        // Contact
        let contactId = contactByPhone.get(contactPhone);
        if (!contactId) {
          const { data: found } = await db
            .from('contacts')
            .select('id')
            .eq('user_id', instanceOwnerId)
            .eq('phone', contactPhone)
            .maybeSingle();
          if (found?.id) {
            contactId = found.id as string;
            contactByPhone.set(contactPhone, contactId);
          }
        }
        if (!contactId) {
          const rawName = chat.name || chat.pushName;
          const { data: newContact, error: contactError } = await db
            .from('contacts')
            .insert({
              user_id: instanceOwnerId,
              phone: contactPhone,
              name: isValidContactName(rawName) ? rawName! : 'Cliente',
              status: 'active',
              ...(labelId ? { label_id: labelId } : {}),
            })
            .select('id')
            .single();
          if (contactError || !newContact) { chatsWithErrors++; continue; }
          contactId = newContact.id as string;
          contactByPhone.set(contactPhone, contactId);
          contactsCreated++;
        }

        // Conversation lookup may be missing from the prefetched map for LID-resolved contacts.
        if (!convByContact.has(contactId)) {
          const { data: existingConv } = await db
            .from('conversations')
            .select('id')
            .eq('user_id', instanceOwnerId)
            .eq('instance_id', instanceId)
            .eq('contact_id', contactId)
            .maybeSingle();
          if (existingConv?.id) convByContact.set(contactId, existingConv.id as string);
        }

        // Conversation
        let conversationId = convByContact.get(contactId);
        if (!conversationId) {
          const { data: newConversation, error: convError } = await db
            .from('conversations')
            .insert({ user_id: instanceOwnerId, contact_id: contactId, instance_id: instanceId, status: 'active' })
            .select('id')
            .single();
          if (convError || !newConversation) { chatsWithErrors++; continue; }
          conversationId = newConversation.id as string;
          convByContact.set(contactId, conversationId);
          conversationsCreated++;
        }

        // Bulk upsert messages (unique index on whatsapp_message_id handles dedup)
        const rows = filteredMessages.map((msg: any) => {
          const whatsappMessageId = msg.key?.id;
          if (!whatsappMessageId) return null;
          const parsed = extractContent(msg.message);
          if (!parsed) return null;
          const direction = msg.key?.fromMe === true ? 'outbound' : 'inbound';
          const timestamp = msg.messageTimestamp
            ? new Date(msg.messageTimestamp * 1000).toISOString()
            : new Date().toISOString();
          return {
            conversation_id: conversationId,
            user_id: instanceOwnerId,
            direction,
            content: parsed.content,
            message_type: parsed.type,
            status: direction === 'inbound' ? 'received' : 'sent',
            whatsapp_message_id: whatsappMessageId,
            sent_at: timestamp,
            created_at: timestamp,
          };
        }).filter(Boolean) as Array<Record<string, unknown>>;

        if (rows.length > 0) {
          // De-duplicate inside the payload itself.
          const seen = new Set<string>();
          const unique = rows.filter((r) => {
            const key = r.whatsapp_message_id as string;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          let chatHadError = false;
          for (let s = 0; s < unique.length; s += 200) {
            const chunk = unique.slice(s, s + 200);
            const ids = chunk.map((r) => r.whatsapp_message_id as string);

            // The unique index on whatsapp_message_id is partial, so ON CONFLICT
            // is not usable via PostgREST. Filter existing ids manually instead.
            const { data: existing, error: existingError } = await db
              .from('inbox_messages')
              .select('whatsapp_message_id')
              .in('whatsapp_message_id', ids);

            if (existingError) {
              console.error('[SYNC] dedup check error:', existingError.message);
              chatHadError = true;
              continue;
            }

            const existingIds = new Set((existing ?? []).map((e: any) => e.whatsapp_message_id));
            const toInsert = chunk.filter((r) => !existingIds.has(r.whatsapp_message_id as string));
            if (toInsert.length === 0) continue;

            const { data: inserted, error: insertError } = await db
              .from('inbox_messages')
              .insert(toInsert)
              .select('id');

            if (insertError) {
              // 23505 = duplicate key: another worker inserted it, not a real failure.
              if ((insertError as any).code === '23505') continue;
              console.error('[SYNC] insert error:', insertError.message);
              chatHadError = true;
            } else {
              messagesImported += inserted?.length ?? 0;
            }
          }
          if (chatHadError) chatsWithErrors++;
        }


        // Conversation preview
        const lastMsg = filteredMessages[filteredMessages.length - 1];
        const lastParsed = extractContent(lastMsg?.message);
        await db.from('conversations').update({
          last_message_at: lastMsg?.messageTimestamp
            ? new Date(lastMsg.messageTimestamp * 1000).toISOString()
            : new Date().toISOString(),
          last_message_preview: (lastParsed?.content ?? '').substring(0, 100),
        }).eq('id', conversationId);
      } catch (chatError) {
        chatsWithErrors++;
        console.error(`[SYNC] Error processing chat ${remoteJid}:`, chatError);
      }
    }
  } catch (batchError) {
    console.error('[SYNC] Batch failed:', batchError);
    await db.from('message_sync_jobs').update({
      status: 'failed',
      error_message: batchError instanceof Error ? batchError.message : String(batchError),
      finished_at: new Date().toISOString(),
      lease_until: null,
    }).eq('id', jobId);
    return;
  }

  const processed = offset + slice.length;
  const done = processed >= totalChats;

  await db.from('message_sync_jobs').update({
    processed_chats: processed,
    messages_imported: (job.messages_imported ?? 0) + messagesImported,
    contacts_created: (job.contacts_created ?? 0) + contactsCreated,
    conversations_created: (job.conversations_created ?? 0) + conversationsCreated,
    chats_with_errors: (job.chats_with_errors ?? 0) + chatsWithErrors,
    status: done ? 'completed' : 'running',
    finished_at: done ? new Date().toISOString() : null,
    lease_until: null,
  }).eq('id', jobId);

  console.log(`[SYNC] Job ${jobId} batch done: ${processed}/${totalChats} chats, +${messagesImported} msgs, +${contactsCreated} contacts`);


  if (!done) {
    await new Promise((r) => setTimeout(r, 500)); // cooldown between hops
    await invokeNextBatch(jobId);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const db = admin();
    const body = await req.json();
    const action = body.action ?? 'start';

    // ---------- Continue an existing job ----------
    if (action === 'process') {
      if (!body.jobId) return json({ error: 'jobId is required' }, 400);
      EdgeRuntime.waitUntil(processBatch(body.jobId));
      return json({ accepted: true });
    }

    // ---------- Status polling ----------
    if (action === 'status') {
      if (!body.jobId) return json({ error: 'jobId is required' }, 400);
      const { data: job } = await db
        .from('message_sync_jobs')
        .select('id, status, total_chats, processed_chats, messages_imported, contacts_created, conversations_created, chats_with_errors, error_message, chats_source')
        .eq('id', body.jobId)
        .maybeSingle();
      if (!job) return json({ error: 'Job não encontrado' }, 404);
      return json({ job });
    }

    // ---------- Start a new job ----------
    const { instanceName, startDate, userId } = body;
    if (!instanceName || !userId) {
      return json({ error: 'instanceName and userId are required' }, 400);
    }

    const { data: instanceData, error: instanceError } = await db
      .from('whatsapp_instances')
      .select('id, user_id, default_funnel_id, evolution_instance_name')
      .eq('instance_name', instanceName)
      .maybeSingle();

    if (instanceError || !instanceData) {
      return json({ error: 'Instância não encontrada' }, 404);
    }

    // Prevent two concurrent syncs on the same instance.
    const { data: activeJob } = await db
      .from('message_sync_jobs')
      .select('id, processed_chats, total_chats')
      .eq('instance_id', instanceData.id)
      .in('status', ['pending', 'running'])
      .gt('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
      .maybeSingle();

    if (activeJob) {
      return json({
        success: true,
        alreadyRunning: true,
        jobId: activeJob.id,
        message: 'Já existe uma sincronização em andamento para esta instância.',
      });
    }

    const evolutionName = instanceData.evolution_instance_name || instanceName;
    const { chats, chatsSource, evolutionWarning } = await buildChatList(evolutionName, instanceData.user_id);

    if (chats.length === 0) {
      return json({
        success: false,
        evolutionError: evolutionWarning ||
          'Não foi possível listar conversas da instância. A Evolution API retornou erro interno e não há contatos no banco para tentar individualmente. Tente reconectar a instância (logout + novo QR Code) e tentar novamente em alguns minutos.',
      });
    }

    const { data: job, error: jobError } = await db
      .from('message_sync_jobs')
      .insert({
        user_id: instanceData.user_id,
        instance_id: instanceData.id,
        instance_name: instanceName,
        evolution_instance_name: evolutionName,
        start_date: startDate || null,
        status: 'pending',
        chats_source: chatsSource,
        chats,
        total_chats: chats.length,
      })
      .select('id')
      .single();

    if (jobError || !job) {
      return json({ error: `Não foi possível iniciar a sincronização: ${jobError?.message ?? 'erro desconhecido'}` }, 500);
    }

    console.log(`[SYNC] Job ${job.id} created for ${evolutionName} with ${chats.length} chats (source: ${chatsSource})`);
    EdgeRuntime.waitUntil(processBatch(job.id));

    return json({
      success: true,
      jobId: job.id,
      totalChats: chats.length,
      source: chatsSource,
      evolutionWarning,
    }, 202);
  } catch (error) {
    console.error('[SYNC] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: message }, 500);
  }
});
