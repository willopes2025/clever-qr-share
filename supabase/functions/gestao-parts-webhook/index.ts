// Recebe as notificações de mudança de status de pedido do ERP Gestão Parts
// e movimenta o card no funil "Pedidos Condicionais".
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  applyStatus,
  ensureDeal,
  fetchProcessStatus,
  loadStatusFunnel,
  parsePedido,
  pick,
  resolveCreds,
  type Row,
} from "../_shared/gestaoPartsStatus.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const expected = Deno.env.get('GESTAO_PARTS_WEBHOOK_TOKEN') || '';
  const provided = url.searchParams.get('token') || url.pathname.split('/').pop() || '';
  if (expected && provided !== expected) return json({ error: 'Unauthorized' }, 401);

  if (req.method === 'GET') return json({ ok: true });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let payload: Row = {};
  try {
    payload = (await req.json()) as Row;
  } catch {
    payload = {};
  }

  let ownerId: string | null = null;
  try {
    const ctx = await loadStatusFunnel(admin);
    ownerId = ctx.ownerId;

    // O ERP pode enviar um objeto ou uma lista de pedidos
    const items: Row[] = Array.isArray(payload)
      ? payload as Row[]
      : Array.isArray((payload as Row).pedidos)
        ? (payload as Row).pedidos as Row[]
        : [payload];

    const results: Array<Record<string, unknown>> = [];

    for (const item of items) {
      const info = parsePedido(item);
      let status = pick(item, ['status', 'situacao', 'descstatus', 'statuspedido']);

      // Sem status no payload: consulta o processo interno no ERP
      if (!status && info.chaveProcesso) {
        try {
          const creds = await resolveCreds(admin);
          status = await fetchProcessStatus(creds, info.chaveProcesso);
        } catch (e) {
          console.error('[GP-WEBHOOK] fetch status', (e as Error).message);
        }
      }

      if (!info.phone && info.numero) {
        results.push({ pedido: info.numero, skipped: 'sem telefone' });
        continue;
      }

      const ids = await ensureDeal(admin, ctx, info);
      if (!ids) { results.push({ pedido: info.numero, skipped: 'sem contato' }); continue; }

      const applied = await applyStatus(admin, ctx, ids.dealId, ids.contactId, status, info.chaveProcesso);
      results.push({ pedido: info.numero, status, ...applied });
    }

    await admin.from('webhook_logs').insert({
      user_id: ownerId,
      direction: 'inbound',
      action: 'gestao_parts_status',
      status: 'success',
      request_payload: payload as unknown as Record<string, unknown>,
      response_payload: { results },
    }).then(() => {}, () => {});

    return json({ received: true, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[GP-WEBHOOK] error', message);
    if (ownerId) {
      await admin.from('webhook_logs').insert({
        user_id: ownerId,
        direction: 'inbound',
        action: 'gestao_parts_status',
        status: 'error',
        request_payload: payload as unknown as Record<string, unknown>,
        error_message: message,
      }).then(() => {}, () => {});
    }
    // Responde 200 para o ERP não ficar reenviando indefinidamente
    return json({ received: true, error: message });
  }
});
