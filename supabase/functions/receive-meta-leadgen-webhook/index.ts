// Webhook público para Lead Ads do Facebook/Instagram (campo `leadgen` da Page)
// GET = verificação (hub.challenge). POST = evento com leadgen_id -> busca lead completo e cria contato/deal + mensagem no inbox
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
};

const VERIFY_TOKEN = Deno.env.get('META_WHATSAPP_VERIFY_TOKEN') ?? '';
const APP_SECRET = Deno.env.get('META_WHATSAPP_APP_SECRET') ?? '';
const GRAPH = 'https://graph.facebook.com/v21.0';

function normalizePhone(p?: string | null): string {
  if (!p) return '';
  let c = String(p).replace(/\D/g, '');
  if (c.startsWith('55') && c.length >= 12 && c.length <= 13) return c;
  if (c.length >= 10 && c.length <= 11) return '55' + c;
  return c;
}

async function verifySignature(rawBody: string, signature: string | null): Promise<boolean> {
  if (!signature || !APP_SECRET) return false;
  const expected = signature.replace('sha256=', '');
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hex === expected;
}

function humanize(k: string) {
  const t = k.replace(/[_-]+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);

  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return new Response(challenge ?? '', { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const rawBody = await req.text();
  const sigValid = await verifySignature(rawBody, req.headers.get('x-hub-signature-256'));

  let payload: any = {};
  try { payload = JSON.parse(rawBody); } catch { /* noop */ }

  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  for (const entry of entries) {
    const pageId = String(entry?.id ?? '');
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      if (change?.field !== 'leadgen') continue;
      const v = change.value || {};
      const leadgenId = v.leadgen_id;
      const formId = v.form_id;
      const adId = v.ad_id;
      const createdTime = v.created_time;
      if (!leadgenId) continue;

      // Log receipt
      await supabase.from('meta_messenger_webhook_events').insert({
        platform: 'messenger',
        event_type: 'leadgen',
        page_id: pageId,
        method: 'POST',
        status_code: 200,
        signature_valid: sigValid,
        payload: change,
        processed: false,
      });

      // Resolve account (page_access_token)
      const { data: account } = await supabase
        .from('meta_messenger_accounts')
        .select('id, user_id, organization_id, page_access_token, page_name')
        .eq('page_id', pageId)
        .maybeSingle();
      if (!account?.page_access_token) {
        console.warn('[leadgen] no page account/token for', pageId);
        continue;
      }

      // Fetch full lead
      const leadRes = await fetch(
        `${GRAPH}/${leadgenId}?fields=field_data,created_time,ad_id,form_id,campaign_id,campaign_name,ad_name,adset_id,adset_name&access_token=${account.page_access_token}`,
      );
      const leadJson = await leadRes.json();
      if (leadJson?.error) {
        console.error('[leadgen] fetch lead error:', leadJson.error);
        continue;
      }

      const fieldData: Array<{ name: string; values: string[] }> = leadJson.field_data || [];
      const fields = fieldData.map(f => ({
        key: f.name,
        label: humanize(f.name),
        value: (f.values || []).join(', '),
      }));
      const map: Record<string, string> = {};
      for (const f of fieldData) map[f.name.toLowerCase()] = (f.values || [])[0] || '';

      const fullName = map['full_name'] || map['name'] || map['first_name']
        ? `${map['first_name'] || ''} ${map['last_name'] || ''}`.trim() || (map['full_name'] || map['name'] || 'Lead Meta Ads')
        : 'Lead Meta Ads';
      const email = map['email'] || null;
      const rawPhone = map['phone_number'] || map['phone'] || '';
      const phone = normalizePhone(rawPhone);

      // Idempotency: skip if already imported
      const externalId = String(leadgenId);
      const { data: existing } = await supabase
        .from('inbox_messages')
        .select('id')
        .eq('whatsapp_message_id', `leadgen:${externalId}`)
        .maybeSingle();
      if (existing) continue;

      // Upsert contact by phone (fallback: create with phone or a synthetic key)
      let contactId: string | null = null;
      if (phone) {
        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id')
          .eq('user_id', account.user_id)
          .eq('phone', phone)
          .maybeSingle();
        if (existingContact) {
          contactId = existingContact.id;
          await supabase.from('contacts').update({
            name: fullName,
            ...(email ? { email } : {}),
          }).eq('id', existingContact.id);
        } else {
          const { data: newContact } = await supabase
            .from('contacts')
            .insert({
              user_id: account.user_id,
              name: fullName,
              phone,
              email,
            })
            .select('id')
            .single();
          contactId = newContact?.id ?? null;
        }
      }

      // Find or create conversation (only if we have a contact)
      let conversationId: string | null = null;
      if (contactId) {
        const { data: conv } = await supabase
          .from('conversations')
          .upsert({
            user_id: account.user_id,
            contact_id: contactId,
          }, { onConflict: 'user_id,contact_id' })
          .select('id')
          .single();
        conversationId = conv?.id ?? null;
      }

      if (conversationId) {
        const messageContent = JSON.stringify({
          type: 'form_response',
          title: 'Resposta ao formulário (Meta Ads)',
          fields,
          source: 'meta_lead_ads',
          form_id: formId,
          ad_id: adId,
        });
        await supabase.from('inbox_messages').insert({
          user_id: account.user_id,
          conversation_id: conversationId,
          content: messageContent,
          direction: 'inbound',
          status: 'received',
          message_type: 'form_response',
          whatsapp_message_id: `leadgen:${externalId}`,
          created_at: createdTime ? new Date(createdTime).toISOString() : new Date().toISOString(),
          ad_reply: {
            source: 'meta_lead_ads',
            source_id: adId ?? null,
            form_id: formId ?? null,
            campaign_id: leadJson.campaign_id ?? null,
            campaign_name: leadJson.campaign_name ?? null,
            ad_name: leadJson.ad_name ?? null,
          },
        });
      }
    }
  }

  return new Response('EVENT_RECEIVED', { status: 200, headers: corsHeaders });
});
