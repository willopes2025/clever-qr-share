import { createClient } from "npm:@supabase/supabase-js@2";
import { gpCall, normalizePaged, onlyDigits, parseEndpoint, PEDIDO_TIPOS, type GpCreds } from "./erp.ts";
import { normalizePhone } from "../_shared/phone.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Destino padrão: funil "Teste" → etapa "Novo Lead"
const DEFAULT_FUNNEL_ID = 'cabd8131-6cf9-4a8a-a18f-33d72d9275bb';
const DEFAULT_STAGE_ID = 'a025ae81-9d10-409a-84e3-1fe5bdd89d95';
const MAX_BLOCOS = 40;

type Row = Record<string, unknown>;

const pick = (row: Row, keys: string[]): string => {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
};

const toNumber = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v ?? '').trim();
  if (!s) return 0;
  // Formato BR ("1.234,56") só quando há vírgula decimal
  s = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

// Telefones "fake" do ERP (000000000, 999999999, etc.)
const isJunkPhone = (d: string): boolean => /^(\d)\1+$/.test(d);

const extractPhone = (row: Row): string => {
  const candidates: string[] = [];
  const fones = row.fones;
  if (fones && typeof fones === 'object') {
    for (const v of Object.values(fones as Row)) candidates.push(onlyDigits(v));
  }
  for (const k of ['celular', 'fonecelular', 'telefone', 'fone', 'fone1', 'telefone1', 'whatsapp']) {
    candidates.push(onlyDigits(row[k]));
  }
  // Prefere celular (11 dígitos com DDD) e depois qualquer telefone válido
  const valid = candidates.filter((d) => d.length >= 10 && d.length <= 13 && !isJunkPhone(d));
  const mobile = valid.find((d) => {
    const local = d.startsWith('55') && d.length >= 12 ? d.slice(2) : d;
    return local.length === 11;
  });
  return normalizePhone(mobile || valid[0] || '');
};

const titleCase = (name: string): string =>
  name.toLowerCase().replace(/\b[\p{L}]/gu, (c) => c.toUpperCase()).trim();

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
    const providedSecret = req.headers.get('x-sync-secret') || '';
    const isCron = bearer === serviceKey || (!!syncSecret && providedSecret === syncSecret);

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
    const days = Math.min(Math.max(Number(body.days ?? 15) || 15, 1), 90);
    const funnelId = String(body.funnel_id || DEFAULT_FUNNEL_ID);
    const stageId = String(body.stage_id || DEFAULT_STAGE_ID);
    const dryRun = Boolean(body.dry_run);
    const debug = Boolean(body.debug);
    const background = body.background !== false;
    const dateFrom = typeof body.from === 'string' ? body.from : '';
    const dateTo = typeof body.to === 'string' ? body.to : '';

    const doWork = async () => {
    // Funil de destino define o dono dos leads criados
    const { data: funnel } = await admin
      .from('funnels').select('id, user_id, name').eq('id', funnelId).maybeSingle();
    if (!funnel) throw new Error('Funil de destino não encontrado');
    const ownerId = funnel.user_id as string;

    const { data: integration } = await admin
      .from('integrations')
      .select('id, credentials')
      .eq('provider', 'gestao_parts')
      .eq('is_active', true)
      .maybeSingle();

    const raw = (integration?.credentials || {}) as Record<string, string>;
    const username = raw.username || Deno.env.get('GESTAO_PARTS_USERNAME') || '';
    const password = raw.password || Deno.env.get('GESTAO_PARTS_PASSWORD') || '';
    if (!username || !password) throw new Error('Integração Gestão Parts não configurada');
    const creds: GpCreds = { username, password, endpoint: parseEndpoint(raw.base_url || Deno.env.get('GESTAO_PARTS_BASE_URL') || '') };

    // Escopo de contatos: a organização inteira do dono do funil
    const { data: memberIds } = await admin.rpc('get_organization_member_ids', { _user_id: ownerId });
    const scopeIds: string[] = Array.isArray(memberIds) && memberIds.length
      ? memberIds.map((m: unknown) => (typeof m === 'string' ? m : (m as { get_organization_member_ids: string }).get_organization_member_ids))
      : [ownerId];
    if (!scopeIds.includes(ownerId)) scopeIds.push(ownerId);

    // 1) Busca todos os pedidos do período (feed paginado por bloco)
    const hoje = dateTo ? new Date(`${dateTo}T12:00:00Z`) : new Date();
    const inicio = dateFrom ? new Date(`${dateFrom}T12:00:00Z`) : new Date(hoje.getTime() - days * 86400000);
    const dtinicio = inicio.toISOString().slice(0, 10);
    const dtfinal = hoje.toISOString().slice(0, 10);
    const pedidos: Row[] = [];
    let bloco = 1;
    let totalBlocos = 1;
    while (bloco <= Math.min(totalBlocos, MAX_BLOCOS)) {
      const page = normalizePaged(
        await gpCall(creds, 'GET', '/erpssplus/v3/pedido/feed', {
          bloco,
          tipopedido: PEDIDO_TIPOS,
          dtinicio,
          dtfinal,
        }),
        ['pedidos'],
      );
      pedidos.push(...page.items);
      totalBlocos = page.totalblocos || 1;
      if (!page.items.length) break;
      bloco++;
    }

    // 2) Agrupa por cliente
    const clientes = new Map<string, {
      nome: string; phone: string; documento: string; codigo: string; total: number; pedidos: Row[];
    }>();

    for (const p of pedidos) {
      const codigo = pick(p, ['codpessoa', 'codigopessoa', 'codcliente', 'codigocliente']);
      const documento = onlyDigits(pick(p, ['cpfcnpj', 'cnpj', 'cpf', 'documento']));
      const phone = extractPhone(p);
      const key = codigo || documento || phone;
      if (!key) continue;
      const nome = pick(p, ['despessoa', 'nome', 'nomepessoa', 'cliente', 'nomecliente', 'razaosocial', 'nomefantasia', 'fantasia']);
      const valor = toNumber(p.total ?? p.valortotal ?? p.vlrtotal ?? p.valor ?? p.totalpedido);
      const existing = clientes.get(key);
      if (existing) {
        existing.total += valor;
        existing.pedidos.push(p);
        if (!existing.phone && phone) existing.phone = phone;
        if (!existing.documento && documento) existing.documento = documento;
        if (!existing.nome && nome) existing.nome = nome;
      } else {
        clientes.set(key, { nome, phone, documento, codigo, total: valor, pedidos: [p] });
      }
    }

    const summary = {
      periodo: { de: inicio.toISOString().slice(0, 10), ate: hoje.toISOString().slice(0, 10) },
      pedidos: pedidos.length,
      clientes: clientes.size,
      leads_criados: 0,
      contatos_criados: 0,
      ja_tinham_lead: 0,
      sem_dados: 0,
      erros: [] as string[],
      ...(debug ? { amostra: pedidos.slice(0, 2) } : {}),
    };

    if (dryRun) return summary;

    // 3) Cria contatos/leads em lotes
    const lista = Array.from(clientes.values());
    for (let i = 0; i < lista.length; i += 8) {
      const lote = lista.slice(i, i + 8);
      await Promise.all(lote.map(async (c) => {
        try {
          if (!c.phone) { summary.sem_dados++; return; }

          const { data: found } = await admin
            .from('contacts')
            .select('id')
            .eq('phone', c.phone)
            .in('user_id', scopeIds)
            .limit(1)
            .maybeSingle();

          let contactId = found?.id as string | undefined;

          if (!contactId) {
            // O display_id é gerado por trigger e pode colidir em inserts paralelos → retenta
            let lastErrMsg = '';
            for (let attempt = 0; attempt < 6 && !contactId; attempt++) {
              const { data: created, error: cErr } = await admin
                .from('contacts')
                .insert({
                  user_id: ownerId,
                  phone: c.phone,
                  name: c.nome ? titleCase(c.nome) : null,
                  custom_fields: {
                    ...(c.documento ? { documento: c.documento } : {}),
                    ...(c.codigo ? { codigo_erp: c.codigo } : {}),
                    origem: 'Gestão Parts',
                  },
                })
                .select('id')
                .single();
              if (!cErr) {
                contactId = created.id as string;
                summary.contatos_criados++;
                break;
              }
              lastErrMsg = cErr.message;
              if (!/contacts_user_display_id_unique|duplicate key/i.test(cErr.message)) break;
              await new Promise((r) => setTimeout(r, 150 + Math.random() * 400));
            }
            if (!contactId) throw new Error(`contato ${c.phone}: ${lastErrMsg}`);
          }

          const { data: existingDeal } = await admin
            .from('funnel_deals')
            .select('id')
            .eq('contact_id', contactId)
            .eq('funnel_id', funnelId)
            .limit(1)
            .maybeSingle();

          let dealId = existingDeal?.id as string | undefined;

          if (dealId) {
            summary.ja_tinham_lead++;
          } else {
            const { data: deal, error: dErr } = await admin
              .from('funnel_deals')
              .insert({
                user_id: ownerId,
                funnel_id: funnelId,
                stage_id: stageId,
                contact_id: contactId,
                title: c.nome ? titleCase(c.nome) : c.phone,
                value: Number(c.total.toFixed(2)),
                source: 'gestao_parts',
                custom_fields: {
                  ...(c.codigo ? { codigo_erp: c.codigo } : {}),
                  ...(c.documento ? { documento: c.documento } : {}),
                },
              })
              .select('id')
              .single();
            if (dErr) throw new Error(`lead ${c.phone}: ${dErr.message}`);
            dealId = deal.id as string;
            summary.leads_criados++;
          }

          // Snapshot do ERP no cartão do lead
          await admin.from('gestao_parts_lead_data').upsert({
            user_id: ownerId,
            contact_id: contactId,
            deal_id: dealId,
            lookup_phone: c.phone,
            lookup_document: c.documento || null,
            erp_codigo: c.codigo || null,
            erp_nome: c.nome || null,
            pedidos: c.pedidos,
            pedidos_count: c.pedidos.length,
            pedidos_total: Number(c.total.toFixed(2)),
            last_synced_at: new Date().toISOString(),
          }, { onConflict: 'contact_id' });
        } catch (e) {
          if (summary.erros.length < 20) summary.erros.push((e as Error).message);
        }
      }));
    }

    console.log('[GestaoPartsSyncLeads]', JSON.stringify({ ...summary, amostra: undefined }));

    return summary;
    }; // fim doWork

    if (background && !dryRun) {
      // @ts-ignore EdgeRuntime global
      EdgeRuntime.waitUntil(doWork().catch((e) => console.error('[GestaoPartsSyncLeads] bg error:', (e as Error).message)));
      return new Response(JSON.stringify({ data: { started: true, days, funnel_id: funnelId } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await doWork();
    return new Response(JSON.stringify({ data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[GestaoPartsSyncLeads] Error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
