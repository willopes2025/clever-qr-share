// Registra (ou remove) a URL de webhook de pedidos no ERP Gestão Parts.
import { createClient } from "npm:@supabase/supabase-js@2";
import { gpCall } from "../_shared/gestaoPartsErp.ts";
import { resolveCreds } from "../_shared/gestaoPartsStatus.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

export function buildWebhookUrl(): string {
  const base = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
  const token = Deno.env.get('GESTAO_PARTS_WEBHOOK_TOKEN') || '';
  return `${base}/functions/v1/gestao-parts-webhook${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
    const syncSecret = Deno.env.get('GESTAO_PARTS_SYNC_SECRET') || '';
    const trusted = bearer === serviceKey || bearer === anonKey
      || (!!syncSecret && req.headers.get('x-sync-secret') === syncSecret);
    if (!trusted) {
      const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await client.auth.getUser();
      if (!user) return json({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'register');
    const creds = await resolveCreds(admin);
    const url = buildWebhookUrl();

    const targets = ['/erpssplus/webhook/pedido/status', '/erpssplus/webhook/pedido'];
    const results: Array<Record<string, unknown>> = [];

    for (const path of targets) {
      try {
        const res = action === 'remove'
          ? await gpCall(creds, 'DELETE', path)
          : await gpCall(creds, 'PUT', path, { url });
        results.push({ path, ok: true, response: res });
      } catch (e) {
        results.push({ path, ok: false, error: (e as Error).message });
      }
    }

    return json({ data: { url, action, results } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[GP-WEBHOOK-REGISTER]', message);
    return json({ error: message }, 500);
  }
});
