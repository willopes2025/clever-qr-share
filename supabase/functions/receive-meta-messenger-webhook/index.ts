// Webhook público para receber eventos de Messenger e Instagram Direct (Meta Graph API)
// GET = verificação do webhook (hub.challenge)
// POST = recebimento de eventos
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
};

const VERIFY_TOKEN = Deno.env.get('META_WHATSAPP_VERIFY_TOKEN') ?? '';
const APP_SECRET = Deno.env.get('META_WHATSAPP_APP_SECRET') ?? '';

async function verifySignature(rawBody: string, signature: string | null): Promise<boolean> {
  if (!signature || !APP_SECRET) return false;
  const expected = signature.replace('sha256=', '');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hex === expected;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);

  // Webhook verification handshake
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
  const signature = req.headers.get('x-hub-signature-256');
  const sigValid = await verifySignature(rawBody, signature);

  let payload: any = {};
  try { payload = JSON.parse(rawBody); } catch { /* noop */ }

  const object = payload?.object as string | undefined; // 'page' | 'instagram'
  const platform = object === 'instagram' ? 'instagram' : 'messenger';

  // Persist each entry as a separate event row
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  if (entries.length === 0) {
    await supabase.from('meta_messenger_webhook_events').insert({
      platform,
      method: 'POST',
      status_code: 200,
      signature_valid: sigValid,
      payload,
      processed: false,
    });
  } else {
    for (const entry of entries) {
      const pageId = String(entry?.id ?? '');
      const messaging = entry?.messaging?.[0] ?? entry?.changes?.[0]?.value ?? {};
      const senderId = messaging?.sender?.id ?? null;
      const recipientId = messaging?.recipient?.id ?? null;
      const eventType = entry?.messaging ? 'message'
        : entry?.changes?.[0]?.field ?? 'unknown';

      // Try to map account
      let accountId: string | null = null;
      let userId: string | null = null;
      if (platform === 'instagram') {
        const { data } = await supabase
          .from('meta_messenger_accounts')
          .select('id, user_id')
          .eq('ig_business_account_id', pageId)
          .maybeSingle();
        accountId = data?.id ?? null;
        userId = data?.user_id ?? null;
      } else {
        const { data } = await supabase
          .from('meta_messenger_accounts')
          .select('id, user_id')
          .eq('page_id', pageId)
          .maybeSingle();
        accountId = data?.id ?? null;
        userId = data?.user_id ?? null;
      }

      await supabase.from('meta_messenger_webhook_events').insert({
        user_id: userId,
        account_id: accountId,
        platform,
        event_type: eventType,
        page_id: platform === 'messenger' ? pageId : null,
        ig_business_account_id: platform === 'instagram' ? pageId : null,
        sender_id: senderId,
        recipient_id: recipientId,
        method: 'POST',
        status_code: 200,
        signature_valid: sigValid,
        payload: entry,
        processed: false,
      });
    }
  }

  // Always 200 to ack to Meta
  return new Response('EVENT_RECEIVED', { status: 200, headers: corsHeaders });
});
