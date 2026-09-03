// União de leads e conversas com privilégios de serviço.
// Motivo: as políticas RLS de inbox_messages/conversations impedem que um
// vendedor (carteira) mova mensagens de uma conversa que não é dele,
// fazendo a união falhar silenciosamente. Aqui validamos que o usuário
// pertence à mesma organização dos registros e executamos com service role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

interface MergeDealsBody {
  mode: 'deals';
  masterId: string;
  secondaryIds: string[];
  fields: Record<string, unknown> & { stage_id: string };
  mergeTags: boolean;
  mergeNotes: boolean;
  mergeConversations: boolean;
  masterContactId: string | null;
  secondaryContactIds: string[];
  masterConversationId: string | null;
  secondaryConversationIds: string[];
}

interface MergeConversationsBody {
  mode: 'conversations';
  keepConversationId: string;
  mergeConversationId: string;
  contactUpdates?: Record<string, unknown>;
  deleteMerged?: boolean;
}

type Body = MergeDealsBody | MergeConversationsBody;

/** Move todo o conteúdo de uma conversa secundária para a principal */
async function mergeConversationInto(admin: any, keepId: string, secId: string) {
  if (!keepId || !secId || keepId === secId) return;

  const { error: msgErr } = await admin
    .from('inbox_messages')
    .update({ conversation_id: keepId })
    .eq('conversation_id', secId);
  if (msgErr) throw new Error(`Erro ao mover mensagens: ${msgErr.message}`);

  const { count: remaining } = await admin
    .from('inbox_messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', secId);
  if (remaining && remaining > 0) {
    throw new Error(`Falha ao mover ${remaining} mensagens da conversa secundária.`);
  }

  await admin.from('conversation_notes').update({ conversation_id: keepId }).eq('conversation_id', secId);
  await admin.from('conversation_tasks').update({ conversation_id: keepId }).eq('conversation_id', secId);
  await admin.from('voip_calls').update({ conversation_id: keepId }).eq('conversation_id', secId);
  await admin.from('ai_phone_calls').update({ conversation_id: keepId }).eq('conversation_id', secId);

  const { data: existingTags } = await admin
    .from('conversation_tag_assignments').select('tag_id').eq('conversation_id', keepId);
  const existing = new Set((existingTags || []).map((t: any) => t.tag_id));
  const { data: secTags } = await admin
    .from('conversation_tag_assignments').select('tag_id').eq('conversation_id', secId);
  const newTags = (secTags || []).filter((t: any) => !existing.has(t.tag_id));
  if (newTags.length) {
    await admin.from('conversation_tag_assignments')
      .insert(newTags.map((t: any) => ({ conversation_id: keepId, tag_id: t.tag_id })));
  }
  await admin.from('conversation_tag_assignments').delete().eq('conversation_id', secId);

  await admin.from('funnel_deals').update({ conversation_id: keepId }).eq('conversation_id', secId);

  const { data: latest } = await admin
    .from('inbox_messages')
    .select('created_at')
    .eq('conversation_id', keepId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest?.created_at) {
    await admin.from('conversations').update({ last_message_at: latest.created_at }).eq('id', keepId);
  }

  await admin.from('conversations').update({ status: 'archived' }).eq('id', secId);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Escopo organizacional do solicitante
    const { data: scopeRows } = await admin.rpc('get_organization_member_ids', { _user_id: user.id });
    const scope = new Set<string>([user.id, ...((scopeRows as any[]) || []).map((r: any) => (typeof r === 'string' ? r : r.get_organization_member_ids))]);

    const assertScope = (ownerIds: (string | null | undefined)[]) => {
      for (const id of ownerIds) {
        if (id && !scope.has(id)) throw new Error('Sem permissão para unir registros de outra organização');
      }
    };

    const body = await req.json() as Body;

    if (body.mode === 'conversations') {
      const { data: convs } = await admin
        .from('conversations')
        .select('id, user_id, contact_id')
        .in('id', [body.keepConversationId, body.mergeConversationId]);
      assertScope((convs || []).map((c: any) => c.user_id));

      if (body.contactUpdates && Object.keys(body.contactUpdates).length > 0) {
        const keep = (convs || []).find((c: any) => c.id === body.keepConversationId);
        if (keep?.contact_id) {
          const { error } = await admin.from('contacts').update(body.contactUpdates).eq('id', keep.contact_id);
          if (error) throw error;
        }
      }

      await mergeConversationInto(admin, body.keepConversationId, body.mergeConversationId);
      if (body.deleteMerged) {
        await admin.from('conversations').delete().eq('id', body.mergeConversationId);
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ----- União de leads (funnel_deals) -----
    const allIds = [body.masterId, ...body.secondaryIds];
    const { data: dealRows } = await admin
      .from('funnel_deals')
      .select('id, user_id, stage_id')
      .in('id', allIds);
    assertScope((dealRows || []).map((d: any) => d.user_id));

    const master = (dealRows || []).find((d: any) => d.id === body.masterId);
    if (!master) throw new Error('Lead principal não encontrado');

    const stageChanged = master.stage_id !== body.fields.stage_id;
    const update: Record<string, unknown> = {
      stage_id: body.fields.stage_id,
      updated_at: new Date().toISOString(),
    };
    if (stageChanged) update.entered_stage_at = new Date().toISOString();
    if (body.fields.title !== undefined) update.title = body.fields.title;
    if (body.fields.value !== undefined) update.value = body.fields.value;
    if (body.fields.responsible_id !== undefined) update.responsible_id = body.fields.responsible_id;
    if (body.fields.custom_fields !== undefined) update.custom_fields = body.fields.custom_fields;

    const { error: updErr } = await admin.from('funnel_deals').update(update).eq('id', body.masterId);
    if (updErr) throw updErr;

    const contactCustom = body.fields.contact_custom_fields as Record<string, unknown> | undefined;
    if (body.masterContactId && contactCustom && Object.keys(contactCustom).length > 0) {
      const { data: contact } = await admin
        .from('contacts').select('custom_fields').eq('id', body.masterContactId).maybeSingle();
      await admin.from('contacts')
        .update({ custom_fields: { ...((contact?.custom_fields as Record<string, unknown>) || {}), ...contactCustom } })
        .eq('id', body.masterContactId);
    }

    if (stageChanged) {
      await admin.from('funnel_deal_history').insert({
        deal_id: body.masterId,
        from_stage_id: master.stage_id,
        to_stage_id: body.fields.stage_id,
        notes: `União de leads: ${body.secondaryIds.join(', ')}`,
      });
    }

    if (body.mergeConversations && body.masterConversationId) {
      const secConvs = Array.from(new Set(
        (body.secondaryConversationIds || []).filter((c) => c && c !== body.masterConversationId),
      ));
      for (const secId of secConvs) {
        await mergeConversationInto(admin, body.masterConversationId, secId);
      }
    }

    await admin.from('chatbot_executions').update({ deal_id: body.masterId }).in('deal_id', body.secondaryIds);
    await admin.from('automation_execution_log').update({ deal_id: body.masterId }).in('deal_id', body.secondaryIds);
    await admin.from('calendly_events').update({ deal_id: body.masterId }).in('deal_id', body.secondaryIds);

    const secContacts = (body.secondaryContactIds || []).filter((c) => c && c !== body.masterContactId);

    if (body.mergeTags && body.masterContactId && secContacts.length) {
      const { data: tags } = await admin.from('contact_tags').select('tag_id').in('contact_id', secContacts);
      const unique = Array.from(new Set((tags || []).map((t: any) => t.tag_id)));
      if (unique.length) {
        await admin.from('contact_tags')
          .upsert(unique.map((tag_id) => ({ contact_id: body.masterContactId, tag_id })), { onConflict: 'contact_id,tag_id' });
      }
    }

    if (body.mergeNotes && body.masterContactId && secContacts.length) {
      await admin.from('conversation_notes').update({ contact_id: body.masterContactId }).in('contact_id', secContacts);
    }

    const { error: delErr } = await admin.from('funnel_deals').delete().in('id', body.secondaryIds);
    if (delErr) throw delErr;

    return new Response(JSON.stringify({ success: true, mergedCount: body.secondaryIds.length + 1 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[merge-leads]', (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
