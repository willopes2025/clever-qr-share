import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { ensureFreshGmailToken, buildRawMime, EmailChannel } from '../_shared/gmail.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { channel_id, to, cc, bcc, subject, html, text, contact_id, thread_id, in_reply_to } = body ?? {};
    if (!channel_id || !Array.isArray(to) || to.length === 0 || !subject) {
      return new Response(JSON.stringify({ error: 'channel_id, to[], subject required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: channel, error: chErr } = await admin
      .from('email_channels').select('*').eq('id', channel_id).maybeSingle();
    if (chErr || !channel) throw new Error('channel not found');

    // Access check: user must be in same org
    const { data: orgId } = await admin.rpc('resolve_user_organization_id', { _user_id: user.id });
    if (orgId !== channel.organization_id) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (channel.provider !== 'gmail') {
      return new Response(JSON.stringify({ error: 'only gmail supported in phase 1' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = await ensureFreshGmailToken(admin, channel as EmailChannel);
    const raw = buildRawMime({
      fromName: channel.display_name, fromEmail: channel.email_address,
      to, cc, bcc, subject, html, text, inReplyTo: in_reply_to ?? null,
    });

    // Gmail expects threadId at top level of the JSON, not in the raw MIME.
    // Look up the provider_thread_id when a local thread_id was passed.
    let providerThreadId: string | undefined;
    if (thread_id) {
      const { data: th } = await admin
        .from('email_threads').select('provider_thread_id').eq('id', thread_id).maybeSingle();
      providerThreadId = th?.provider_thread_id ?? undefined;
    }

    const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw, ...(providerThreadId ? { threadId: providerThreadId } : {}) }),
    });
    if (!sendRes.ok) {
      const errBody = await sendRes.text();
      console.error('gmail send failed', sendRes.status, errBody);
      return new Response(JSON.stringify({ error: 'gmail send failed', status: sendRes.status, details: errBody }), {
        status: sendRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const sent = await sendRes.json();
    const gmailThreadId = sent.threadId as string;
    const gmailMessageId = sent.id as string;

    // Upsert thread
    let localThreadId = thread_id as string | undefined;
    if (!localThreadId) {
      const { data: existing } = await admin
        .from('email_threads').select('id')
        .eq('channel_id', channel.id).eq('provider_thread_id', gmailThreadId).maybeSingle();
      if (existing) {
        localThreadId = existing.id;
      } else {
        const { data: created, error: thErr } = await admin
          .from('email_threads').insert({
            organization_id: channel.organization_id,
            channel_id: channel.id,
            contact_id: contact_id ?? null,
            subject, provider_thread_id: gmailThreadId,
            last_message_at: new Date().toISOString(),
          }).select('id').single();
        if (thErr) throw thErr;
        localThreadId = created.id;
      }
    }

    await admin.from('email_threads').update({
      last_message_at: new Date().toISOString(),
    }).eq('id', localThreadId!);

    const { data: msg, error: msgErr } = await admin.from('email_messages').insert({
      organization_id: channel.organization_id,
      channel_id: channel.id,
      thread_id: localThreadId!,
      contact_id: contact_id ?? null,
      direction: 'outbound',
      provider_message_id: gmailMessageId,
      in_reply_to: in_reply_to ?? null,
      from_address: channel.email_address,
      from_name: channel.display_name,
      to_addresses: to, cc_addresses: cc ?? [], bcc_addresses: bcc ?? [],
      subject, body_html: html ?? null, body_text: text ?? null,
      snippet: (text ?? html ?? '').replace(/<[^>]+>/g, '').slice(0, 200),
      is_read: true, sent_at: new Date().toISOString(),
      sent_by: user.id, status: 'delivered',
    }).select().single();
    if (msgErr) throw msgErr;

    return new Response(JSON.stringify({ ok: true, message_id: msg.id, thread_id: localThreadId }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('email-send error', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
