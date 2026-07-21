// Shared: refresh Gmail access token when expired
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { chunkBase64, PreparedAttachment } from './email-attachments.ts';

export interface EmailChannel {
  id: string;
  organization_id: string;
  email_address: string;
  display_name: string | null;
  oauth_access_token: string | null;
  oauth_refresh_token: string | null;
  oauth_token_expires_at: string | null;
  gmail_history_id: string | null;
}

export async function ensureFreshGmailToken(
  admin: SupabaseClient,
  channel: EmailChannel,
): Promise<string> {
  const now = Date.now();
  const expAt = channel.oauth_token_expires_at ? new Date(channel.oauth_token_expires_at).getTime() : 0;
  if (channel.oauth_access_token && expAt - 60_000 > now) {
    return channel.oauth_access_token;
  }
  if (!channel.oauth_refresh_token) throw new Error('missing refresh token; reconnect Gmail');

  const clientId = Deno.env.get('GMAIL_OAUTH_CLIENT_ID')!;
  const clientSecret = Deno.env.get('GMAIL_OAUTH_CLIENT_SECRET')!;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: channel.oauth_refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    await admin.from('email_channels').update({ status: 'error', last_error: `refresh failed: ${body}` }).eq('id', channel.id);
    throw new Error(`refresh failed [${res.status}]: ${body}`);
  }
  const t = await res.json();
  const newExpires = new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString();
  await admin.from('email_channels').update({
    oauth_access_token: t.access_token,
    oauth_token_expires_at: newExpires,
    status: 'active',
    last_error: null,
  }).eq('id', channel.id);
  return t.access_token;
}

export function buildRawMime(opts: {
  fromName?: string | null; fromEmail: string;
  to: string[]; cc?: string[]; bcc?: string[];
  subject: string; html?: string; text?: string;
  inReplyTo?: string | null;
  attachments?: PreparedAttachment[];
}): string {
  const fromHeader = opts.fromName ? `"${opts.fromName}" <${opts.fromEmail}>` : opts.fromEmail;
  const headers = [
    `From: ${fromHeader}`,
    `To: ${opts.to.join(', ')}`,
  ];
  if (opts.cc?.length) headers.push(`Cc: ${opts.cc.join(', ')}`);
  if (opts.bcc?.length) headers.push(`Bcc: ${opts.bcc.join(', ')}`);
  headers.push(`Subject: ${opts.subject}`);
  headers.push('MIME-Version: 1.0');
  if (opts.inReplyTo) {
    headers.push(`In-Reply-To: ${opts.inReplyTo}`);
    headers.push(`References: ${opts.inReplyTo}`);
  }
  const html = opts.html ?? (opts.text ? `<pre>${escapeHtml(opts.text)}</pre>` : '');
  const text = opts.text ?? stripHtml(html);
  const altBoundary = `alt_${crypto.randomUUID().replace(/-/g, '')}`;
  const alternativePart = [
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    '',
    `--${altBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '', text,
    `--${altBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '', html,
    `--${altBoundary}--`,
  ].join('\r\n');

  const attachments = opts.attachments ?? [];
  let raw: string;
  if (attachments.length === 0) {
    raw = headers.join('\r\n') + '\r\n' + alternativePart;
  } else {
    const mixedBoundary = `mixed_${crypto.randomUUID().replace(/-/g, '')}`;
    headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
    const parts: string[] = ['', `--${mixedBoundary}`, alternativePart];
    for (const a of attachments) {
      parts.push(`--${mixedBoundary}`);
      parts.push(`Content-Type: ${a.contentType}; name="${a.filename}"`);
      parts.push(`Content-Transfer-Encoding: base64`);
      parts.push(`Content-Disposition: attachment; filename="${a.filename}"`);
      parts.push('');
      parts.push(chunkBase64(a.base64));
    }
    parts.push(`--${mixedBoundary}--`);
    raw = headers.join('\r\n') + '\r\n' + parts.join('\r\n');
  }
  // base64url
  return btoa(unescape(encodeURIComponent(raw))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function stripHtml(s: string) { return s.replace(/<[^>]+>/g, ''); }
