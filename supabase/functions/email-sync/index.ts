import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { ensureFreshGmailToken, EmailChannel } from '../_shared/gmail.ts';
import { ensureFreshMsToken, MsChannel } from '../_shared/microsoft.ts';
import { NativeImap, parseSearchUids, imapDate } from '../_shared/imap-native.ts';
import { simpleParser } from 'npm:mailparser@3.7.1';
import { Buffer } from 'node:buffer';

// Body: { channel_id? } — if omitted, syncs all active channels.

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
      const { data } = await admin.from('email_channels').select('id').eq('status', 'active');
      channelIds = (data ?? []).map((r: any) => r.id);
    }

    const results: any[] = [];
    for (const id of channelIds) {
      try {
        const { data: channel } = await admin.from('email_channels').select('*').eq('id', id).single();
        if (!channel) continue;
        let synced: any;
        if (channel.provider === 'gmail') synced = await syncGmail(admin, channel);
        else if (channel.provider === 'microsoft') synced = await syncMicrosoft(admin, channel);
        else if (channel.provider === 'imap') synced = await syncImap(admin, channel);
        else synced = { skipped: `provider ${channel.provider} not supported` };
        results.push({ channel_id: id, ...synced });
      } catch (e) {
        console.error('sync failed for', id, e);
        await admin.from('email_channels').update({ status: 'error', last_error: String(e) }).eq('id', id);
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

// ---------- GMAIL ----------
async function syncGmail(admin: any, channel: EmailChannel) {
  const accessToken = await ensureFreshGmailToken(admin, channel);
  const listRes = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=' + encodeURIComponent('in:inbox OR in:sent'),
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!listRes.ok) throw new Error(`gmail list [${listRes.status}]: ${await listRes.text()}`);
  const list = await listRes.json();
  const msgs = list.messages ?? [];
  let imported = 0;
  for (const m of msgs) {
    const { data: existing } = await admin.from('email_messages')
      .select('id').eq('channel_id', channel.id).eq('provider_message_id', m.id).maybeSingle();
    if (existing) continue;
    const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } });
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
    const { html, text } = extractGmailBody(detail.payload);
    const isInbound = fromEmail.toLowerCase() !== channel.email_address.toLowerCase();
    const localThreadId = await upsertThread(admin, channel, detail.threadId, subject, isInbound, fromEmail, toList[0] ?? '', receivedAt);
    await admin.from('email_messages').insert({
      organization_id: channel.organization_id, channel_id: channel.id, thread_id: localThreadId,
      direction: isInbound ? 'inbound' : 'outbound', provider_message_id: detail.id,
      from_address: fromEmail, from_name: fromName, to_addresses: toList, cc_addresses: ccList,
      subject, body_html: html, body_text: text, snippet: (detail.snippet ?? '').slice(0, 200),
      is_read: !isInbound, received_at: isInbound ? receivedAt : null, sent_at: !isInbound ? receivedAt : null,
      status: 'delivered',
    });
    imported++;
  }
  await admin.from('email_channels').update({ last_synced_at: new Date().toISOString() }).eq('id', channel.id);
  return { imported };
}

// ---------- MICROSOFT ----------
async function syncMicrosoft(admin: any, channel: MsChannel & any) {
  const accessToken = await ensureFreshMsToken(admin, channel);
  let imported = 0;
  for (const folder of ['inbox', 'sentitems']) {
    const url = `https://graph.microsoft.com/v1.0/me/mailFolders/${folder}/messages?$top=25&$orderby=receivedDateTime desc&$select=id,conversationId,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,bodyPreview,body,isRead`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`ms list ${folder} [${res.status}]: ${await res.text()}`);
    const data = await res.json();
    for (const m of data.value ?? []) {
      const { data: existing } = await admin.from('email_messages')
        .select('id').eq('channel_id', channel.id).eq('provider_message_id', m.id).maybeSingle();
      if (existing) continue;
      const fromEmail = m.from?.emailAddress?.address ?? '';
      const fromName = m.from?.emailAddress?.name ?? null;
      const toList = (m.toRecipients ?? []).map((r: any) => r.emailAddress?.address).filter(Boolean);
      const ccList = (m.ccRecipients ?? []).map((r: any) => r.emailAddress?.address).filter(Boolean);
      const receivedAt = m.receivedDateTime ?? m.sentDateTime ?? new Date().toISOString();
      const isInbound = folder === 'inbox';
      const localThreadId = await upsertThread(admin, channel, m.conversationId, m.subject ?? '', isInbound, fromEmail, toList[0] ?? '', receivedAt);
      const html = m.body?.contentType === 'html' ? m.body?.content : null;
      const text = m.body?.contentType === 'text' ? m.body?.content : null;
      await admin.from('email_messages').insert({
        organization_id: channel.organization_id, channel_id: channel.id, thread_id: localThreadId,
        direction: isInbound ? 'inbound' : 'outbound', provider_message_id: m.id,
        from_address: fromEmail, from_name: fromName, to_addresses: toList, cc_addresses: ccList,
        subject: m.subject ?? '', body_html: html, body_text: text, snippet: (m.bodyPreview ?? '').slice(0, 200),
        is_read: !isInbound || !!m.isRead,
        received_at: isInbound ? receivedAt : null, sent_at: !isInbound ? receivedAt : null,
        status: 'delivered',
      });
      imported++;
    }
  }
  await admin.from('email_channels').update({ last_synced_at: new Date().toISOString() }).eq('id', channel.id);
  return { imported };
}

// ---------- IMAP ----------
async function syncImap(admin: any, channel: any) {
  const client = new NativeImap({
    host: channel.imap_host,
    port: Number(channel.imap_port),
    secure: !!channel.imap_secure,
    user: channel.auth_username,
    pass: channel.auth_password,
  });
  await client.connect();
  let imported = 0;
  try {
    for (const mailbox of ['INBOX', 'Sent', 'INBOX.Sent', 'Sent Items', '[Gmail]/Enviados']) {
      try {
        await client.command(`SELECT "${mailbox.replace(/"/g, '\\"')}"`);
      } catch { continue; }
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      let uids: number[] = [];
      try {
        const searchResp = await client.command(`UID SEARCH SINCE ${imapDate(since)}`);
        uids = parseSearchUids(searchResp);
      } catch { continue; }
      const recent = uids.slice(-50);
      if (recent.length === 0) continue;

      // Filter out uids already stored, then fetch in one batch.
      const providerIds = recent.map((u) => `${mailbox}:${u}`);
      const { data: existingRows } = await admin.from('email_messages')
        .select('provider_message_id').eq('channel_id', channel.id).in('provider_message_id', providerIds);
      const existingSet = new Set((existingRows ?? []).map((r: any) => r.provider_message_id));
      const missing = recent.filter((u) => !existingSet.has(`${mailbox}:${u}`));
      if (missing.length === 0) continue;

      const fetched = await client.fetchRawByUids(missing);
      for (const { uid, raw } of fetched) {
        const providerId = `${mailbox}:${uid}`;
        try {
          const parsed = await simpleParser(Buffer.from(raw));
          const fromEmail = parsed.from?.value?.[0]?.address ?? '';
          const fromName = parsed.from?.value?.[0]?.name ?? null;
          const toList = (parsed.to as any)?.value?.map((v: any) => v.address).filter(Boolean) ?? [];
          const ccList = (parsed.cc as any)?.value?.map((v: any) => v.address).filter(Boolean) ?? [];
          const subject = parsed.subject ?? '';
          const receivedAt = (parsed.date ?? new Date()).toISOString();
          const isInbound = fromEmail.toLowerCase() !== channel.email_address.toLowerCase();
          const threadKey = parsed.messageId ?? providerId;
          const localThreadId = await upsertThread(admin, channel, threadKey, subject, isInbound, fromEmail, toList[0] ?? '', receivedAt);
          await admin.from('email_messages').insert({
            organization_id: channel.organization_id, channel_id: channel.id, thread_id: localThreadId,
            direction: isInbound ? 'inbound' : 'outbound', provider_message_id: providerId,
            from_address: fromEmail, from_name: fromName, to_addresses: toList, cc_addresses: ccList,
            subject, body_html: parsed.html || null, body_text: parsed.text || null,
            snippet: (parsed.text ?? '').slice(0, 200),
            is_read: !isInbound,
            received_at: isInbound ? receivedAt : null, sent_at: !isInbound ? receivedAt : null,
            status: 'delivered',
          });
          imported++;
        } catch (e) {
          console.error('parse/insert failed', providerId, e);
        }
      }
    }
  } finally {
    await client.logout();
  }
  await admin.from('email_channels').update({ last_synced_at: new Date().toISOString(), status: 'active', last_error: null }).eq('id', channel.id);
  return { imported };
}

// ---------- shared helpers ----------
async function upsertThread(admin: any, channel: any, providerThreadId: string, subject: string, isInbound: boolean, fromEmail: string, toEmail: string, receivedAt: string): Promise<string> {
  const { data: th } = await admin.from('email_threads')
    .select('id').eq('channel_id', channel.id).eq('provider_thread_id', providerThreadId).maybeSingle();
  if (th) {
    await admin.from('email_threads').update({ last_message_at: receivedAt, subject: subject || undefined }).eq('id', th.id);
    return th.id;
  }
  const lookupEmail = isInbound ? fromEmail : toEmail;
  const contactId = await findContactByEmail(admin, channel.organization_id, lookupEmail);
  const { data: created } = await admin.from('email_threads').insert({
    organization_id: channel.organization_id, channel_id: channel.id, contact_id: contactId,
    subject, provider_thread_id: providerThreadId, last_message_at: receivedAt,
    unread_count: isInbound ? 1 : 0,
  }).select('id').single();
  return created.id;
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
function extractGmailBody(payload: any): { html: string | null; text: string | null } {
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
