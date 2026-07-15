// Shared: refresh Gmail access token when expired
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

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
  const boundary = `bnd_${crypto.randomUUID().replace(/-/g, '')}`;
  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
  const body = [
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '', text,
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '', html,
    `--${boundary}--`,
  ].join('\r\n');
  const raw = headers.join('\r\n') + '\r\n' + body;
  // base64url
  return btoa(unescape(encodeURIComponent(raw))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function stripHtml(s: string) { return s.replace(/<[^>]+>/g, ''); }
