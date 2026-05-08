// Envia mensagens via Meta Graph API para Messenger ou Instagram Direct
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendBody {
  account_id: string;       // meta_messenger_accounts.id
  platform: 'messenger' | 'instagram';
  recipient_id: string;     // PSID (messenger) or IG-scoped user id
  message: {
    text?: string;
    attachment?: { type: 'image' | 'audio' | 'video' | 'file'; url: string };
  };
  messaging_type?: 'RESPONSE' | 'UPDATE' | 'MESSAGE_TAG';
  tag?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json() as SendBody;
  if (!body?.account_id || !body?.recipient_id || !body?.message) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: account, error: accErr } = await supabase
    .from('meta_messenger_accounts')
    .select('id, page_id, page_access_token, ig_business_account_id')
    .eq('id', body.account_id)
    .maybeSingle();

  if (accErr || !account) {
    return new Response(JSON.stringify({ error: 'Account not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Build message payload
  const msgPayload: Record<string, unknown> = {};
  if (body.message.text) msgPayload.text = body.message.text;
  if (body.message.attachment) {
    msgPayload.attachment = {
      type: body.message.attachment.type,
      payload: { url: body.message.attachment.url, is_reusable: true },
    };
  }

  const senderObjectId = body.platform === 'instagram'
    ? account.ig_business_account_id
    : account.page_id;

  if (!senderObjectId) {
    return new Response(JSON.stringify({ error: 'Missing sender object id for platform' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = `https://graph.facebook.com/v21.0/${senderObjectId}/messages?access_token=${account.page_access_token}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: body.recipient_id },
      messaging_type: body.messaging_type ?? 'RESPONSE',
      ...(body.tag ? { tag: body.tag } : {}),
      message: msgPayload,
    }),
  });

  const data = await response.json();
  if (!response.ok || data?.error) {
    return new Response(JSON.stringify({ error: data?.error ?? 'Send failed', details: data }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, data }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
