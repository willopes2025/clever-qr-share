import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { SMTPClient } from 'npm:emailjs@4.0.3';

// Native Deno IMAP LOGIN test — more reliable than npm:imapflow in edge runtime.
async function testImapLogin(host: string, port: number, secure: boolean, user: string, pass: string): Promise<void> {
  let conn: Deno.Conn;
  const connectPromise = secure
    ? Deno.connectTls({ hostname: host, port, alpnProtocols: undefined })
    : Deno.connect({ hostname: host, port });
  conn = await Promise.race([
    connectPromise,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('CONNECT_TIMEOUT')), 15000)),
  ]) as Deno.Conn;

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const buf = new Uint8Array(4096);

  async function readOnce(timeoutMs = 10000): Promise<string> {
    const n = await Promise.race([
      conn.read(buf),
      new Promise<null>((_, rej) => setTimeout(() => rej(new Error('READ_TIMEOUT')), timeoutMs)),
    ]);
    if (!n) throw new Error('CONNECTION_CLOSED');
    return decoder.decode(buf.subarray(0, n as number));
  }
  async function readUntil(tag: string, timeoutMs = 15000): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    let acc = '';
    while (Date.now() < deadline) {
      acc += await readOnce(Math.max(500, deadline - Date.now()));
      if (acc.includes(`${tag} OK`) || acc.includes(`${tag} NO`) || acc.includes(`${tag} BAD`)) return acc;
    }
    throw new Error('READ_TIMEOUT');
  }

  try {
    const greeting = await readOnce(10000);
    if (!/\*\s*OK/i.test(greeting)) throw new Error(`BAD_GREETING: ${greeting.slice(0, 120)}`);
    const escaped = pass.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    await conn.write(encoder.encode(`a1 LOGIN "${user}" "${escaped}"\r\n`));
    const resp = await readUntil('a1', 15000);
    if (/a1 OK/i.test(resp)) {
      try { await conn.write(encoder.encode('a2 LOGOUT\r\n')); } catch { /* ignore */ }
      return;
    }
    if (/a1 (NO|BAD)/i.test(resp)) {
      const m = resp.match(/a1 (?:NO|BAD)\s+(.+)/i);
      throw new Error(`AUTH_FAILED: ${m?.[1]?.trim() ?? 'login rejeitado'}`);
    }
    throw new Error(`UNEXPECTED: ${resp.slice(0, 160)}`);
  } finally {
    try { conn.close(); } catch { /* ignore */ }
  }
}

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

    // Test IMAP with native Deno TLS (imapflow is unreliable in edge runtime).
    const attempts: Array<{ host: string; port: number; secure: boolean }> = [
      { host: imap_host, port: Number(imap_port), secure: !!imap_secure },
    ];
    let lastErr: any = null;
    let connected = false;
    let finalHost = imap_host, finalPort = Number(imap_port), finalSecure = !!imap_secure;
    for (const a of attempts) {
      try {
        await testImapLogin(a.host, a.port, a.secure, email, password);
        connected = true;
        finalHost = a.host; finalPort = a.port; finalSecure = a.secure;
        break;
      } catch (e: any) {
        lastErr = e;
        const msg = e?.message || String(e);
        if (msg.startsWith('AUTH_FAILED')) {
          return new Response(JSON.stringify({ error: `Credenciais IMAP inválidas: ${msg.replace('AUTH_FAILED: ', '')}. Se a conta usa 2FA, gere uma senha de app.` }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }
    if (!connected) {
      const code = lastErr?.message || String(lastErr);
      const hint = /TIMEOUT|CLOSED|ECONNRESET|EHOSTUNREACH/i.test(code)
        ? ' Possível bloqueio do provedor a IPs de datacenter (comum em Hostinger/cPanel) — habilite acesso IMAP externo no painel do provedor ou libere o IP.'
        : ' Confirme host/porta/SSL e se o provedor permite IMAP.';
      return new Response(JSON.stringify({ error: `IMAP falhou ao conectar em ${imap_host}:${imap_port} (${code}).${hint}` }), {
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
        imap_host: finalHost, imap_port: finalPort, imap_secure: finalSecure,
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
