import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { ensureFreshGmailToken, EmailChannel } from '../_shared/gmail.ts';

// Trigger with { channel_id } or without body to sync all active gmail channels.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    let channelIds: string[] = [];
    try {
      const body = await req.json();
      if (body?.channel_id) channelIds = [body.channel_id];
    } catch { /* no body */ }

    if (channelIds.length === 0) {
      const { data } = await admin.from('email_channels')
        .select('id').eq('provider', 'gmail').eq('status', 'active');
      channelIds = (data ?? []).map((r: any) => r.id);
    }

    const results: any[] = [];
    for (const id of channelIds) {
      try {
        const { data: channel } = await admin.from('email_channels').select('*').eq('id', id).single();
        if (!channel) continue;
        const synced = await syncGmailChannel(admin, channel as EmailChannel);
        results.push({ channel_id: id, ...synced });
      } catch (e) {
        console.error('sync failed for', id, e);
        results.push({ channel_id: id, error: String(e) });
      }
    }
    return new Response(JSON.stringify({ ok: true, results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('email-sync error', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function syncGmailChannel(admin: any, channel: EmailChannel) {
  const accessToken = await ensureFreshGmailToken(admin, channel);

  // Fetch recent messages (max 20). Phase 1: simple polling, not History API.
  const listRes = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=in:inbox',
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!listRes.ok) throw new Error(`gmail list [${listRes.status}]: ${await listRes.text()}`);
  const list = await listRes.json();
  const msgs = list.messages ?? [];

  let imported = 0;
  for (const m of msgs) {
    // Skip if we already have this message id
    const { data: existing } = await admin.from('email_messages')
      .select('id').eq('channel_id', channel.id).eq('provider_message_id', m.id).maybeSingle();
    if (existing) continue;

    const detailRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!detailRes.ok) continue;
    const detail = await detailRes.json();
    const headers: Record<string, string> = {};
    for (const h of detail.payload?.headers ?? []) headers[h.name.toLowerCase()] = h.value;

    const fromRaw = headers['from'] ?? '';
    const { name: fromName, email: fromEmail } = parseAddress(fromRaw);
    const toList = splitAddr(headers['to']);
    const ccList = splitAddr(headers['cc']);
    const subject = headers['subject'] ?? '';
    const dateHeader = headers['date'];
    const receivedAt = dateHeader ? new Date(dateHeader).toISOString() : new Date(parseInt(detail.internalDate ?? '0')).toISOString();
    const { html, text } = extractBody(detail.payload);
    const isInbound = fromEmail.toLowerCase() !== channel.email_address.toLowerCase();

    // Upsert thread
    let localThreadId: string;
    const { data: th } = await admin.from('email_threads')
      .select('id').eq('channel_id', channel.id).eq('provider_thread_id', detail.threadId).maybeSingle();
    if (th) {
      localThreadId = th.id;
      await admin.from('email_threads').update({
        last_message_at: receivedAt, subject: subject || undefined,
      }).eq('id', localThreadId);
    } else {
      const contactId = isInbound ? await findContactByEmail(admin, channel.organization_id, fromEmail) : null;
      const { data: created } = await admin.from('email_threads').insert({
        organization_id: channel.organization_id,
        channel_id: channel.id,
        contact_id: contactId,
        subject,
        provider_thread_id: detail.threadId,
        last_message_at: receivedAt,
        unread_count: isInbound ? 1 : 0,
      }).select('id').single();
      localThreadId = created.id;
    }

    await admin.from('email_messages').insert({
      organization_id: channel.organization_id,
      channel_id: channel.id,
      thread_id: localThreadId,
      direction: isInbound ? 'inbound' : 'outbound',
      provider_message_id: detail.id,
      from_address: fromEmail,
      from_name: fromName,
      to_addresses: toList,
      cc_addresses: ccList,
      subject,
      body_html: html,
      body_text: text,
      snippet: (detail.snippet ?? '').slice(0, 200),
      is_read: !isInbound,
      received_at: isInbound ? receivedAt : null,
      sent_at: !isInbound ? receivedAt : null,
      status: 'delivered',
    });
    imported++;
  }

  await admin.from('email_channels').update({ last_synced_at: new Date().toISOString() }).eq('id', channel.id);
  return { imported };
}

function parseAddress(raw: string): { name: string | null; email: string } {
  const m = raw.match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].replace(/^"|"$/g, '').trim() || null, email: m[2].trim() };
  return { name: null, email: raw.trim() };
}
function splitAddr(raw?: string): string[] {
  if (!raw) return [];
  return raw.split(',').map(s => parseAddress(s.trim()).email).filter(Boolean);
}
function extractBody(payload: any): { html: string | null; text: string | null } {
  let html: string | null = null, text: string | null = null;
  const walk = (p: any) => {
    if (!p) return;
    if (p.mimeType === 'text/html' && p.body?.data) html = decode(p.body.data);
    else if (p.mimeType === 'text/plain' && p.body?.data) text = decode(p.body.data);
    if (p.parts) for (const pp of p.parts) walk(pp);
  };
  walk(payload);
  return { html, text };
}
function decode(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  try { return decodeURIComponent(escape(atob(b64))); } catch { return atob(b64); }
}
async function findContactByEmail(admin: any, orgId: string, email: string): Promise<string | null> {
  if (!email) return null;
  const { data } = await admin.from('contacts').select('id')
    .eq('organization_id', orgId).ilike('email', email).limit(1).maybeSingle();
  return data?.id ?? null;
}
