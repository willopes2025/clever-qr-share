import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// Callback is loaded by the browser via redirect from Google.
// Cannot check auth via JWT (Google redirect has no auth header).
// Trust `state` (contains user id) — attacker controlling state cannot get a valid Google code for someone else.

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  const html = (title: string, msg: string, ok = true) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui;background:#0b0f19;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.card{background:#151b2b;padding:40px;border-radius:12px;max-width:420px;text-align:center;border:1px solid #223}
h1{margin:0 0 12px;font-size:20px;color:${ok ? '#4ade80' : '#f87171'}}
p{color:#a1a1aa;margin:0 0 20px}
button{background:#3b82f6;color:#fff;border:0;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px}</style></head>
<body><div class="card"><h1>${title}</h1><p>${msg}</p><button onclick="window.close()">Fechar</button></div>
<script>setTimeout(()=>{if(window.opener){window.opener.postMessage({type:'gmail-oauth',ok:${ok}},'*');}},300);</script></body></html>`;

  if (errorParam) {
    return new Response(html('Autorização cancelada', errorParam, false), {
      status: 200, headers: { 'Content-Type': 'text/html' },
    });
  }
  if (!code || !state) {
    return new Response(html('Erro', 'Parâmetros inválidos', false), {
      status: 400, headers: { 'Content-Type': 'text/html' },
    });
  }

  try {
    const decoded = atob(state);
    const userId = decoded.split(':')[0];
    if (!userId) throw new Error('invalid state');

    const clientId = Deno.env.get('GMAIL_OAUTH_CLIENT_ID')!;
    const clientSecret = Deno.env.get('GMAIL_OAUTH_CLIENT_SECRET')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const redirectUri = `${supabaseUrl}/functions/v1/email-oauth-callback`;

    // Exchange code
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret,
        redirect_uri: redirectUri, grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error('token exchange failed', tokenRes.status, body);
      return new Response(html('Falha ao trocar código', body, false), {
        status: 200, headers: { 'Content-Type': 'text/html' },
      });
    }
    const tokens = await tokenRes.json();
    const { access_token, refresh_token, expires_in, scope } = tokens;

    // Get user profile
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!profileRes.ok) throw new Error('failed to load profile');
    const profile = await profileRes.json();
    const emailAddress: string = profile.email;
    const displayName: string = profile.name ?? emailAddress;

    // Service role client - trust state
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: orgRow, error: orgErr } = await admin.rpc('resolve_user_organization_id', { _user_id: userId });
    if (orgErr || !orgRow) throw new Error('user has no organization');
    const organizationId = orgRow;

    const expiresAt = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString();

    const { error: upsertErr } = await admin
      .from('email_channels')
      .upsert({
        organization_id: organizationId,
        provider: 'gmail',
        email_address: emailAddress,
        display_name: displayName,
        oauth_access_token: access_token,
        oauth_refresh_token: refresh_token,
        oauth_token_expires_at: expiresAt,
        oauth_scope: scope,
        status: 'active',
        last_error: null,
        created_by: userId,
      }, { onConflict: 'organization_id,email_address' });
    if (upsertErr) throw upsertErr;

    return new Response(
      html('Gmail conectado!', `${emailAddress} está pronto para receber e enviar e-mails no Widezap.`),
      { status: 200, headers: { 'Content-Type': 'text/html' } },
    );
  } catch (e) {
    console.error('email-oauth-callback error', e);
    return new Response(html('Erro', String(e), false), {
      status: 500, headers: { 'Content-Type': 'text/html' },
    });
  }
});
