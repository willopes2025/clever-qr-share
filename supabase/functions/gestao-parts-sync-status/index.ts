// Fallback do webhook: varre os pedidos condicionais recentes no ERP,
// garante o card no funil "Pedidos Condicionais" e aplica o status atual.
import { createClient } from "npm:@supabase/supabase-js@2";
import { gpCall, normalizePaged } from "../_shared/gestaoPartsErp.ts";
import {
  applyStatus,
  ensureDeal,
  fetchProcessStatus,
  loadStatusFunnel,
  parsePedido,
  resolveCreds,
  type Row,
} from "../_shared/gestaoPartsStatus.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_BLOCOS = 40;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
    const syncSecret = Deno.env.get('GESTAO_PARTS_SYNC_SECRET') || '';
    const isCron = bearer === serviceKey || bearer === anonKey
      || (!!syncSecret && req.headers.get('x-sync-secret') === syncSecret);

    if (!isCron) {
      const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await client.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const body = await req.json().catch(() => ({}));
    const days = Math.min(Math.max(Number(body.days ?? 20) || 20, 1), 90);
    const background = body.background !== false;
    // Cargas manuais, retroativas e periódicas nunca enviam mensagens.
    const source = body.source === 'manual_sync' ? 'manual_sync' : 'periodic_sync';

    const doWork = async () => {
      const ctx = await loadStatusFunnel(admin);
      const creds = await resolveCreds(admin);

      const hoje = new Date();
      const inicio = new Date(hoje.getTime() - days * 86400000);
      const dtinicio = inicio.toISOString().slice(0, 10);
      const dtfinal = hoje.toISOString().slice(0, 10);

      const pedidos: Row[] = [];
      let bloco = 1;
      let totalBlocos = 1;
      while (bloco <= Math.min(totalBlocos, MAX_BLOCOS)) {
        const page = normalizePaged(
          await gpCall(creds, 'GET', '/erpssplus/v3/pedido/feed', {
            bloco, tipopedido: ['CONDICIONAL'], dtinicio, dtfinal,
          }),
          ['pedidos'],
        );
        pedidos.push(...page.items);
        totalBlocos = page.totalblocos || 1;
        if (!page.items.length) break;
        bloco++;
      }

      const summary = {
        periodo: { de: dtinicio, ate: dtfinal },
        pedidos: pedidos.length,
        cards: 0,
        movidos: 0,
        sem_status: 0,
        sem_telefone: 0,
        erros: [] as string[],
      };

      for (let i = 0; i < pedidos.length; i += 5) {
        const lote = pedidos.slice(i, i + 5);
        await Promise.all(lote.map(async (p) => {
          try {
            const info = parsePedido(p);
            if (!info.phone) { summary.sem_telefone++; return; }
            const ids = await ensureDeal(admin, ctx, info);
            if (!ids) { summary.sem_telefone++; return; }
            summary.cards++;

            const status = info.chaveProcesso ? await fetchProcessStatus(creds, info.chaveProcesso) : '';
            if (!status) { summary.sem_status++; return; }

            const applied = await applyStatus(admin, ctx, ids.dealId, ids.contactId, status, {
              chaveProcesso: info.chaveProcesso,
              silent: true,
              source,
            });
            if (applied.moved) summary.movidos++;
          } catch (e) {
            if (summary.erros.length < 20) summary.erros.push((e as Error).message);
          }
        }));
      }

      console.log('[GP-SYNC-STATUS]', JSON.stringify(summary));
      return summary;
    };

    if (background) {
      // @ts-ignore EdgeRuntime global
      EdgeRuntime.waitUntil(doWork().catch((e) => console.error('[GP-SYNC-STATUS] bg', (e as Error).message)));
      return new Response(JSON.stringify({ data: { started: true, days } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await doWork();
    return new Response(JSON.stringify({ data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[GP-SYNC-STATUS] error', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
