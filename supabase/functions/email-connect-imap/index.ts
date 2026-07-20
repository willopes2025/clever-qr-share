import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { ImapFlow } from 'npm:imapflow@1.0.164';
import { SMTPClient } from 'npm:emailjs@4.0.3';

// Connect a generic IMAP/SMTP mailbox. Body: {
//   email, password, display_name?,
//   imap_host, imap_port, imap_secure,
//   smtp_host, smtp_port, smtp_secure
// }

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
    const {
      email, password, display_name,
      imap_host, imap_port, imap_secure = true,
      smtp_host, smtp_port, smtp_secure = true,
    } = body ?? {};

    if (!email || !password || !imap_host || !imap_port || !smtp_host || !smtp_port) {
      return new Response(JSON.stringify({ error: 'missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Test IMAP
    const imap = new ImapFlow({
      host: imap_host,
      port: Number(imap_port),
      secure: !!imap_secure,
      auth: { user: email, pass: password },
      logger: false,
    });
    try {
      await imap.connect();
      await imap.logout();
    } catch (e) {
      return new Response(JSON.stringify({ error: `IMAP login falhou: ${String(e)}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Test SMTP
    try {
      const smtp = new SMTPClient({
        user: email,
        password,
        host: smtp_host,
        port: Number(smtp_port),
        ssl: !!smtp_secure && Number(smtp_port) === 465,
        tls: !!smtp_secure && Number(smtp_port) !== 465,
        timeout: 10000,
      });
      // emailjs opens on send; do a NOOP by connecting the SMTP protocol via .smtp
      await new Promise<void>((resolve, reject) => {
        (smtp as any).smtp.connect((err: any) => {
          if (err) reject(err);
          else { (smtp as any).smtp.quit(); resolve(); }
        });
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: `SMTP login falhou: ${String(e)}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: orgRow, error: orgErr } = await admin.rpc('resolve_user_organization_id', { _user_id: user.id });
    if (orgErr || !orgRow) throw new Error('user has no organization');
    const organizationId = orgRow;

    const { error: upsertErr } = await admin
      .from('email_channels')
      .upsert({
        organization_id: organizationId,
        provider: 'imap',
        email_address: email,
        display_name: display_name ?? email,
        auth_username: email,
        auth_password: password,
        imap_host, imap_port: Number(imap_port), imap_secure: !!imap_secure,
        smtp_host, smtp_port: Number(smtp_port), smtp_secure: !!smtp_secure,
        status: 'active',
        last_error: null,
        created_by: user.id,
      }, { onConflict: 'organization_id,email_address' });
    if (upsertErr) throw upsertErr;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('email-connect-imap error', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
