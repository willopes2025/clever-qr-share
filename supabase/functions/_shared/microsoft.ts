// Shared: refresh Microsoft Graph access token
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

export interface MsChannel {
  id: string;
  organization_id: string;
  email_address: string;
  oauth_access_token: string | null;
  oauth_refresh_token: string | null;
  oauth_token_expires_at: string | null;
}

export const MS_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'User.Read',
  'Mail.ReadWrite',
  'Mail.Send',
].join(' ');

export async function ensureFreshMsToken(admin: SupabaseClient, channel: MsChannel): Promise<string> {
  const now = Date.now();
  const expAt = channel.oauth_token_expires_at ? new Date(channel.oauth_token_expires_at).getTime() : 0;
  if (channel.oauth_access_token && expAt - 60_000 > now) return channel.oauth_access_token;
  if (!channel.oauth_refresh_token) throw new Error('missing refresh token; reconnect Microsoft');

  const clientId = Deno.env.get('MICROSOFT_OAUTH_CLIENT_ID')!;
  const clientSecret = Deno.env.get('MICROSOFT_OAUTH_CLIENT_SECRET')!;
  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: channel.oauth_refresh_token,
      grant_type: 'refresh_token',
      scope: MS_SCOPES,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    await admin.from('email_channels').update({ status: 'error', last_error: `ms refresh failed: ${body}` }).eq('id', channel.id);
    throw new Error(`ms refresh failed [${res.status}]: ${body}`);
  }
  const t = await res.json();
  const newExpires = new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString();
  await admin.from('email_channels').update({
    oauth_access_token: t.access_token,
    oauth_refresh_token: t.refresh_token ?? channel.oauth_refresh_token,
    oauth_token_expires_at: newExpires,
    status: 'active',
    last_error: null,
  }).eq('id', channel.id);
  return t.access_token;
}
