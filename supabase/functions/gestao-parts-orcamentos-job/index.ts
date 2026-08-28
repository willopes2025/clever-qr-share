// Job de 15 minutos: envia automaticamente os orçamentos novos ainda não enviados.
// Regras: desligado por padrão, sem efeito retroativo (corte em activated_at),
// lote limitado, trava de execução única e parada em falhas consecutivas.
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveCreds } from "../_shared/gestaoPartsStatus.ts";
import {
  fetchOrcamentos,
  orcamentoEmitidoEm,
  orcamentoEmpresa,
  orcamentoNumero,
  resolveOwner,
  sendOrcamento,
} from "../_shared/gestaoPartsOrcamento.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LEASE_SECONDS = 600;
const MAX_FAILURES = 5;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
    const isCron = bearer === serviceKey || bearer === anonKey;
    if (!isCron) {
      const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await client.auth.getUser();
      if (!user) return json({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json().catch(() => ({}));

    const { data: config } = await admin
      .from('gestao_parts_orcamento_config').select('*').eq('id', 1).maybeSingle();
    if (!config) return json({ skipped: 'configuração ausente' });

    if (!config.auto_send_enabled && body.force !== true) {
      return json({ skipped: 'envio automático desligado' });
    }
    if (config.consecutive_failures >= MAX_FAILURES && body.force !== true) {
      return json({ skipped: 'job pausado após falhas consecutivas' });
    }

    // Trava de execução única
    const now = new Date();
    const { data: leased } = await admin
      .from('gestao_parts_orcamento_config')
      .update({ lease_until: new Date(now.getTime() + LEASE_SECONDS * 1000).toISOString() })
      .eq('id', 1)
      .or(`lease_until.is.null,lease_until.lt.${now.toISOString()}`)
      .select('id')
      .maybeSingle();
    if (!leased && body.force !== true) return json({ skipped: 'execução já em andamento' });

    // Corte: nada anterior à ativação da funcionalidade
    const cutoff = config.activated_at ? new Date(config.activated_at) : now;
    const batchSize = Math.min(Math.max(Number(config.batch_size ?? 20) || 20, 1), 100);

    const creds = await resolveCreds(admin);
    const ctx = await resolveOwner(admin);

    const dtfinal = now.toISOString().slice(0, 10);
    const dtinicio = new Date(Math.max(cutoff.getTime(), now.getTime() - 3 * 86400000))
      .toISOString().slice(0, 10);

    const orcamentos = await fetchOrcamentos(creds, dtinicio, dtfinal, 40);

    // Só os emitidos após a ativação
    const elegiveis = orcamentos.filter((row) => {
      const emitido = orcamentoEmitidoEm(row);
      return !!emitido && new Date(emitido).getTime() >= cutoff.getTime();
    });

    // Descarta os que já possuem registro (enviado, em andamento ou falho)
    const numeros = elegiveis.map(orcamentoNumero).filter(Boolean);
    const jaRegistrados = new Set<string>();
    if (numeros.length) {
      const { data: envios } = await admin
        .from('gestao_parts_orcamento_envios')
        .select('empresa, numero')
        .in('numero', numeros.slice(0, 1000));
      for (const e of (envios || []) as Array<Record<string, unknown>>) {
        jaRegistrados.add(`${String(e.empresa ?? '')}|${String(e.numero)}`);
      }
    }

    const pendentes = elegiveis
      .filter((row) => !jaRegistrados.has(`${orcamentoEmpresa(row)}|${orcamentoNumero(row)}`))
      .slice(0, batchSize);

    const summary = { encontrados: orcamentos.length, elegiveis: elegiveis.length, enviados: 0, ignorados: 0, falhas: 0, detalhes: [] as unknown[] };

    for (const row of pendentes) {
      const res = await sendOrcamento(admin, row, {
        origin: 'auto',
        dryRun: !!config.dry_run,
        template: config.message_template ?? null,
        ctx,
      });
      if (res.status === 'sent') summary.enviados++;
      else if (res.status === 'failed') summary.falhas++;
      else summary.ignorados++;
      summary.detalhes.push(res);
      await new Promise((r) => setTimeout(r, 1200));
    }

    const failedRun = pendentes.length > 0 && summary.enviados === 0 && summary.falhas > 0;
    await admin.from('gestao_parts_orcamento_config').update({
      last_run_at: new Date().toISOString(),
      last_run_summary: summary,
      lease_until: null,
      consecutive_failures: failedRun ? (config.consecutive_failures ?? 0) + 1 : 0,
    }).eq('id', 1);

    console.log('[GP-ORC-JOB]', JSON.stringify({ ...summary, detalhes: undefined }));
    return json(summary);
  } catch (e) {
    console.error('[GP-ORC-JOB]', (e as Error).message);
    await admin.from('gestao_parts_orcamento_config')
      .update({ lease_until: null, last_run_at: new Date().toISOString() }).eq('id', 1);
    return json({ error: (e as Error).message }, 500);
  }
});
