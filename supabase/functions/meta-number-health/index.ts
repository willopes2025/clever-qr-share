import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getMetaTokenForNumber } from '../_shared/metaToken.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

type HealthRequest = {
  phoneNumberId?: string;
  metaNumberId?: string;
};

type RecentEvent = {
  id: string;
  received_at: string;
  event_type: string | null;
  method: string | null;
  status_code: number | null;
  error: string | null;
  signature_valid: boolean | null;
  payload?: any;
};

type RecentMessage = {
  id: string;
  created_at: string;
  direction: string | null;
  status: string | null;
  message_type: string | null;
  content: string | null;
};

function normalizePhoneDigits(phone: string | undefined | null): string {
  return (phone || '').replace(/\D/g, '');
}

function phonesMatch(a: string | undefined | null, b: string | undefined | null): boolean {
  const na = normalizePhoneDigits(a);
  const nb = normalizePhoneDigits(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.startsWith('55') && na.slice(2) === nb) return true;
  if (nb.startsWith('55') && nb.slice(2) === na) return true;
  return false;
}

function formatAgo(iso: string | null): string | null {
  if (!iso) return null;
  const elapsedMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(elapsedMs)) return null;
  const minutes = Math.max(0, Math.round(elapsedMs / 60000));
  if (minutes < 60) return `${minutes} min atrás`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h atrás`;
  return `${Math.round(hours / 24)} dias atrás`;
}

function getAdminDisplayPhone(payload: any): string | null {
  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      const value = change?.value || {};
      if (value?.display_phone_number) return value.display_phone_number;
      if (value?.metadata?.display_phone_number) return value.metadata.display_phone_number;
    }
  }
  return null;
}

function getAdminWabaId(payload: any): string | null {
  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      const value = change?.value || {};
      if (value?.waba_info?.waba_id) return value.waba_info.waba_id;
    }
    if (entry?.id) return entry.id;
  }
  return null;
}

function toMessagePreview(message: RecentMessage | null) {
  if (!message) return null;
  return {
    id: message.id,
    created_at: message.created_at,
    ago: formatAgo(message.created_at),
    direction: message.direction,
    status: message.status,
    message_type: message.message_type,
    content_preview: (message.content || '').slice(0, 120),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Sessão expirada, faça login novamente' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: { user }, error: userError } = await authedClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Sessão expirada, faça login novamente' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let body: HealthRequest = {};
    try {
      body = await req.json();
    } catch (_error) {
      body = {};
    }

    const phoneNumberId = String(body.phoneNumberId || '').trim();
    const metaNumberId = String(body.metaNumberId || '').trim();

    if (!phoneNumberId && !metaNumberId) {
      return new Response(JSON.stringify({ success: false, error: 'Número Meta não informado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: orgRows } = await serviceClient.rpc('get_organization_member_ids', { _user_id: user.id });
    const orgUserIds = Array.from(new Set(
      ((orgRows || []) as Array<string | { get_organization_member_ids?: string }>)
        .map((row) => typeof row === 'string' ? row : row?.get_organization_member_ids)
        .filter(Boolean) as string[]
    ));
    if (!orgUserIds.includes(user.id)) orgUserIds.push(user.id);

    let numberQuery = serviceClient
      .from('meta_whatsapp_numbers')
      .select('id, user_id, phone_number_id, display_name, phone_number, waba_id, business_account_id, quality_rating, messaging_limit, status, is_active, connected_at, updated_at')
      .in('user_id', orgUserIds)
      .limit(1);

    if (metaNumberId) {
      numberQuery = numberQuery.eq('id', metaNumberId);
    } else {
      numberQuery = numberQuery.eq('phone_number_id', phoneNumberId);
    }

    const { data: numberRows, error: numberError } = await numberQuery;
    const number = numberRows?.[0] || null;

    if (numberError || !number) {
      return new Response(JSON.stringify({ success: false, error: 'Número Meta não encontrado para sua organização' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resolvedPhoneNumberId = number.phone_number_id;
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: events } = await serviceClient
      .from('meta_webhook_events')
      .select('id, received_at, event_type, method, status_code, error, signature_valid, payload')
      .eq('phone_number_id', resolvedPhoneNumberId)
      .order('received_at', { ascending: false })
      .limit(50);

    const { data: unlinkedEvents } = await serviceClient
      .from('meta_webhook_events')
      .select('id, received_at, event_type, method, status_code, error, signature_valid, payload')
      .is('phone_number_id', null)
      .gte('received_at', since24h)
      .order('received_at', { ascending: false })
      .limit(100);

    const matchedAdminEvents = ((unlinkedEvents || []) as RecentEvent[]).filter((event) => {
      const displayPhone = getAdminDisplayPhone(event.payload);
      const wabaId = getAdminWabaId(event.payload);
      return phonesMatch(displayPhone, number.phone_number) || (!!wabaId && wabaId === number.waba_id);
    });

    const allEvents = [
      ...((events || []) as RecentEvent[]),
      ...matchedAdminEvents,
    ].sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());

    const { data: conversations } = await serviceClient
      .from('conversations')
      .select('id, last_message_at, last_message_direction, last_message_preview, status')
      .eq('meta_phone_number_id', resolvedPhoneNumberId)
      .in('user_id', orgUserIds)
      .order('last_message_at', { ascending: false })
      .limit(50);

    const conversationIds = (conversations || []).map((conversation: any) => conversation.id);
    let messages: RecentMessage[] = [];
    if (conversationIds.length > 0) {
      const { data: messageRows } = await serviceClient
        .from('inbox_messages')
        .select('id, created_at, direction, status, message_type, content')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false })
        .limit(80);
      messages = (messageRows || []) as RecentMessage[];
    }

    const latestInbound = messages.find((message) => message.direction === 'inbound') || null;
    const latestOutbound = messages.find((message) => message.direction === 'outbound') || null;
    const latestMessageEvent = allEvents.find((event) => event.event_type === 'message') || null;
    const latestStatusEvent = allEvents.find((event) => event.event_type === 'status') || null;
    const latestAdminEvent = allEvents.find((event) => !['message', 'status'].includes(event.event_type || '')) || null;
    const failedEvents = allEvents.filter((event) => event.error || event.status_code !== 200 || event.signature_valid === false);

    const eventsLast24h = allEvents.filter((event) => new Date(event.received_at).getTime() >= Date.now() - 24 * 60 * 60 * 1000).length;
    const inboundLast24h = messages.filter((message) => message.direction === 'inbound' && new Date(message.created_at).getTime() >= Date.now() - 24 * 60 * 60 * 1000).length;
    const statusLast24h = allEvents.filter((event) => event.event_type === 'status' && new Date(event.received_at).getTime() >= Date.now() - 24 * 60 * 60 * 1000).length;

    let graphStatus: Record<string, unknown> | null = null;
    try {
      const { data: integration } = await serviceClient
        .from('integrations')
        .select('credentials')
        .eq('provider', 'meta_whatsapp')
        .eq('is_active', true)
        .eq('user_id', number.user_id)
        .maybeSingle();

      const accessToken = await getMetaTokenForNumber(
        serviceClient,
        resolvedPhoneNumberId,
        (integration?.credentials as Record<string, string> | undefined)?.access_token,
      );
      if (accessToken) {
        const graphResponse = await fetch(
          `https://graph.facebook.com/v21.0/${resolvedPhoneNumberId}?fields=display_phone_number,verified_name,quality_rating,messaging_limit_tier,status,name_status&access_token=${accessToken}`,
        );
        const graphData = await graphResponse.json();
        graphStatus = graphData?.error
          ? { ok: false, error: graphData.error?.message || 'Erro ao consultar Meta' }
          : { ok: true, data: graphData };
      }
    } catch (error) {
      graphStatus = { ok: false, error: error instanceof Error ? error.message : 'Erro ao consultar Meta' };
    }

    const webhookReceiving = eventsLast24h > 0 || !!latestAdminEvent;
    const outboundOk = !!latestStatusEvent || latestOutbound?.status === 'delivered' || latestOutbound?.status === 'sent';
    const inboundMissingAfterStatus = !!latestStatusEvent && (!latestInbound || new Date(latestStatusEvent.received_at) > new Date(latestInbound.created_at));

    const healthStatus = failedEvents.length > 0
      ? 'warning'
      : webhookReceiving && outboundOk && inboundMissingAfterStatus
        ? 'warning'
        : webhookReceiving
          ? 'ok'
          : 'error';

    const conclusion = !webhookReceiving
      ? 'Não há eventos recentes chegando do Meta para este número. Verifique a inscrição do webhook no app Meta.'
      : inboundMissingAfterStatus
        ? 'A conexão Meta → CRM está ativa para status/envios, mas não chegou nenhuma mensagem recebida nova após a última inbound registrada. Se clientes enviaram mensagens nesse período, a Meta não está entregando esses eventos inbound ao webhook.'
        : 'O webhook está recebendo eventos e há mensagens inbound recentes para este número.';

    return new Response(JSON.stringify({
      success: true,
      checkedAt: new Date().toISOString(),
      healthStatus,
      conclusion,
      number: {
        id: number.id,
        display_name: number.display_name,
        phone_number: number.phone_number,
        phone_number_id: resolvedPhoneNumberId,
        waba_id: number.waba_id,
        status: number.status,
        is_active: number.is_active,
        quality_rating: number.quality_rating,
        messaging_limit: number.messaging_limit,
      },
      counters: {
        events_last_24h: eventsLast24h,
        inbound_messages_last_24h: inboundLast24h,
        status_events_last_24h: statusLast24h,
        conversations: conversationIds.length,
        failed_events: failedEvents.length,
      },
      timeline: {
        latest_event: allEvents[0] ? {
          id: allEvents[0].id,
          received_at: allEvents[0].received_at,
          ago: formatAgo(allEvents[0].received_at),
          event_type: allEvents[0].event_type,
          status_code: allEvents[0].status_code,
          error: allEvents[0].error,
          signature_valid: allEvents[0].signature_valid,
        } : null,
        latest_message_event: latestMessageEvent ? {
          id: latestMessageEvent.id,
          received_at: latestMessageEvent.received_at,
          ago: formatAgo(latestMessageEvent.received_at),
          status_code: latestMessageEvent.status_code,
          signature_valid: latestMessageEvent.signature_valid,
        } : null,
        latest_status_event: latestStatusEvent ? {
          id: latestStatusEvent.id,
          received_at: latestStatusEvent.received_at,
          ago: formatAgo(latestStatusEvent.received_at),
          status_code: latestStatusEvent.status_code,
          signature_valid: latestStatusEvent.signature_valid,
        } : null,
        latest_admin_event: latestAdminEvent ? {
          id: latestAdminEvent.id,
          received_at: latestAdminEvent.received_at,
          ago: formatAgo(latestAdminEvent.received_at),
          event_type: latestAdminEvent.event_type,
          status_code: latestAdminEvent.status_code,
        } : null,
        latest_inbound_message: toMessagePreview(latestInbound),
        latest_outbound_message: toMessagePreview(latestOutbound),
      },
      graphStatus,
      recentFailures: failedEvents.slice(0, 5).map((event) => ({
        id: event.id,
        received_at: event.received_at,
        event_type: event.event_type,
        status_code: event.status_code,
        error: event.error,
        signature_valid: event.signature_valid,
      })),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});