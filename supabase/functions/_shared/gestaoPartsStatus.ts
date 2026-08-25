// Núcleo compartilhado: traduz o status do ERP Gestão Parts em movimentação
// de etapa no funil "Pedidos Condicionais" (usado pelo webhook e pelo cron).

import { gpCall, onlyDigits, parseEndpoint, type GpCreds } from "./gestaoPartsErp.ts";
import { normalizePhone } from "./phone.ts";

// deno-lint-ignore no-explicit-any
type Admin = any;
export type Row = Record<string, unknown>;

export const STATUS_FUNNEL_NAME = 'Pedidos Condicionais';

/** Texto de status do ERP -> nome da etapa do funil */
const STATUS_MAP: Array<{ re: RegExp; stage: string }> = [
  { re: /aguardando separa/i, stage: 'Aguardando separação' },
  { re: /em separa/i, stage: 'Em separação' },
  { re: /separa.+(conclu|finaliz)/i, stage: 'Separação concluída' },
  { re: /aguardando confer/i, stage: 'Aguardando conferência' },
  { re: /em confer/i, stage: 'Em conferência' },
  { re: /confer.+(finaliz|conclu)/i, stage: 'Conferência finalizada' },
  { re: /faturamento|emiss.+nota/i, stage: 'Em faturamento' },
  { re: /faturad/i, stage: 'Faturado' },
  { re: /aguardando libera/i, stage: 'Aguardando liberação de entrega' },
  { re: /liberad.+entrega/i, stage: 'Liberado para entrega' },
  { re: /(enviado|transportador)/i, stage: 'Enviado ao transportador' },
  { re: /entrega conclu|entregue/i, stage: 'Entrega concluída' },
];

export function stageNameForStatus(status: string): string | null {
  const s = String(status || '').trim();
  if (!s) return null;
  // Regras mais específicas primeiro (conclusões antes dos "em andamento")
  const ordered = [...STATUS_MAP].sort((a, b) => b.re.source.length - a.re.source.length);
  for (const m of ordered) if (m.re.test(s)) return m.stage;
  return null;
}

export interface StatusFunnel {
  funnelId: string;
  ownerId: string;
  stages: Map<string, { id: string; order: number }>;
  scopeIds: string[];
}

export async function loadStatusFunnel(admin: Admin): Promise<StatusFunnel> {
  const { data: funnel } = await admin
    .from('funnels').select('id, user_id').eq('name', STATUS_FUNNEL_NAME).limit(1).maybeSingle();
  if (!funnel) throw new Error(`Funil "${STATUS_FUNNEL_NAME}" não encontrado`);

  const { data: stages } = await admin
    .from('funnel_stages').select('id, name, display_order').eq('funnel_id', funnel.id);

  const map = new Map<string, { id: string; order: number }>();
  for (const s of (stages || []) as Row[]) {
    map.set(String(s.name), { id: String(s.id), order: Number(s.display_order ?? 0) });
  }

  const ownerId = String(funnel.user_id);
  const { data: memberIds } = await admin.rpc('get_organization_member_ids', { _user_id: ownerId });
  const scopeIds: string[] = Array.isArray(memberIds) && memberIds.length
    ? memberIds.map((m: unknown) => (typeof m === 'string' ? m : (m as { get_organization_member_ids: string }).get_organization_member_ids))
    : [ownerId];
  if (!scopeIds.includes(ownerId)) scopeIds.push(ownerId);

  return { funnelId: String(funnel.id), ownerId, stages: map, scopeIds };
}

export async function resolveCreds(admin: Admin): Promise<GpCreds> {
  const { data: integration } = await admin
    .from('integrations').select('credentials')
    .eq('provider', 'gestao_parts').eq('is_active', true).limit(1).maybeSingle();
  const raw = (integration?.credentials || {}) as Record<string, string>;
  const username = raw.username || Deno.env.get('GESTAO_PARTS_USERNAME') || '';
  const password = raw.password || Deno.env.get('GESTAO_PARTS_PASSWORD') || '';
  if (!username || !password) throw new Error('Integração Gestão Parts não configurada');
  return {
    username,
    password,
    endpoint: parseEndpoint(raw.base_url || Deno.env.get('GESTAO_PARTS_BASE_URL') || ''),
  };
}

export const pick = (row: Row, keys: string[]): string => {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
};

export const toNumber = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v ?? '').trim();
  if (!s) return 0;
  s = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const isJunkPhone = (d: string): boolean => /^(\d)\1+$/.test(d);

export function extractPhone(row: Row): string {
  const candidates: string[] = [];
  const fones = row.fones;
  if (fones && typeof fones === 'object') {
    for (const v of Object.values(fones as Row)) candidates.push(onlyDigits(v));
  }
  for (const k of ['celular', 'fonecelular', 'telefone', 'fone', 'fone1', 'telefone1', 'whatsapp']) {
    candidates.push(onlyDigits(row[k]));
  }
  const valid = candidates.filter((d) => d.length >= 10 && d.length <= 13 && !isJunkPhone(d));
  const mobile = valid.find((d) => {
    const local = d.startsWith('55') && d.length >= 12 ? d.slice(2) : d;
    return local.length === 11;
  });
  return normalizePhone(mobile || valid[0] || '');
}

export const titleCase = (name: string): string =>
  name.toLowerCase().replace(/\b[\p{L}]/gu, (c) => c.toUpperCase()).trim();

export interface PedidoInfo {
  numero: string;
  chaveProcesso: string;
  nome: string;
  phone: string;
  documento: string;
  codigo: string;
  total: number;
  raw: Row;
}

export function parsePedido(p: Row): PedidoInfo {
  return {
    numero: pick(p, ['numpedido', 'pedido', 'numero', 'codpedido', 'documento']),
    chaveProcesso: pick(p, ['chaveprocesso', 'chave_processo', 'chave']),
    nome: pick(p, ['despessoa', 'nome', 'nomepessoa', 'cliente', 'nomecliente', 'razaosocial', 'nomefantasia', 'fantasia']),
    phone: extractPhone(p),
    documento: onlyDigits(pick(p, ['cpfcnpj', 'cnpj', 'cpf', 'documento_pessoa'])),
    codigo: pick(p, ['codpessoa', 'codigopessoa', 'codcliente', 'codigocliente']),
    total: toNumber(p.total ?? p.valortotal ?? p.vlrtotal ?? p.valor ?? p.totalpedido),
    raw: p,
  };
}

/** Consulta o status atual dos processos internos de um pedido */
export async function fetchProcessStatus(creds: GpCreds, chaveProcesso: string): Promise<string> {
  const res = await gpCall(creds, 'GET', '/erpssplus/v3/pedido/status/processo', { chaveprocesso: chaveProcesso });
  const list: Row[] = Array.isArray(res)
    ? res as Row[]
    : (res && typeof res === 'object'
      ? (Object.values(res as Row).find((v) => Array.isArray(v)) as Row[] | undefined) ?? [res as Row]
      : []);
  if (!list.length) return '';
  // Último processo informado é o estágio mais avançado
  const last = list[list.length - 1];
  return pick(last, ['status', 'processo']);
}

/** Garante contato + card no funil de status. Retorna ids. */
export async function ensureDeal(
  admin: Admin,
  ctx: StatusFunnel,
  info: PedidoInfo,
): Promise<{ contactId: string; dealId: string } | null> {
  if (!info.phone) return null;

  const { data: found } = await admin
    .from('contacts').select('id').eq('phone', info.phone).in('user_id', ctx.scopeIds).limit(1).maybeSingle();

  let contactId = found?.id as string | undefined;

  if (!contactId) {
    let lastErr = '';
    for (let attempt = 0; attempt < 6 && !contactId; attempt++) {
      const { data: created, error } = await admin.from('contacts').insert({
        user_id: ctx.ownerId,
        phone: info.phone,
        name: info.nome ? titleCase(info.nome) : null,
        custom_fields: {
          ...(info.documento ? { documento: info.documento } : {}),
          ...(info.codigo ? { codigo_erp: info.codigo } : {}),
          origem: 'Gestão Parts',
        },
      }).select('id').single();
      if (!error) { contactId = created.id as string; break; }
      lastErr = error.message;
      if (!/contacts_user_display_id_unique|duplicate key/i.test(error.message)) break;
      await new Promise((r) => setTimeout(r, 150 + Math.random() * 400));
    }
    if (!contactId) throw new Error(`contato ${info.phone}: ${lastErr}`);
  }

  // Um card por pedido: procura pelo número do pedido nos campos personalizados
  let dealId: string | undefined;
  if (info.numero) {
    const { data: byPedido } = await admin
      .from('funnel_deals').select('id')
      .eq('funnel_id', ctx.funnelId)
      .eq('contact_id', contactId)
      .contains('custom_fields', { pedido: info.numero })
      .limit(1).maybeSingle();
    dealId = byPedido?.id as string | undefined;
  }

  if (!dealId) {
    const first = ctx.stages.get('Aguardando separação');
    const { data: deal, error } = await admin.from('funnel_deals').insert({
      user_id: ctx.ownerId,
      funnel_id: ctx.funnelId,
      stage_id: first?.id,
      contact_id: contactId,
      title: `Pedido ${info.numero || '-'} · ${info.nome ? titleCase(info.nome) : info.phone}`,
      value: Number(info.total.toFixed(2)),
      source: 'gestao_parts',
      custom_fields: {
        pedido: info.numero,
        ...(info.chaveProcesso ? { chave_processo: info.chaveProcesso } : {}),
        ...(info.codigo ? { codigo_erp: info.codigo } : {}),
        ...(info.documento ? { documento: info.documento } : {}),
      },
    }).select('id').single();
    if (error) throw new Error(`lead ${info.phone}: ${error.message}`);
    dealId = deal.id as string;
  }

  return { contactId, dealId: dealId! };
}

/** Move o card para a etapa do status e dispara as automações da etapa. */
export async function applyStatus(
  admin: Admin,
  ctx: StatusFunnel,
  dealId: string,
  contactId: string | null,
  statusText: string,
  options: {
    chaveProcesso?: string;
    silent?: boolean;
    source?: 'webhook' | 'periodic_sync' | 'manual_sync';
  } = {},
): Promise<{ moved: boolean; stage?: string }> {
  const { chaveProcesso, silent = true, source = 'periodic_sync' } = options;
  const stageName = stageNameForStatus(statusText);
  if (!stageName) return { moved: false };
  const target = ctx.stages.get(stageName);
  if (!target) return { moved: false };

  const { data: deal } = await admin
    .from('funnel_deals').select('id, stage_id').eq('id', dealId).maybeSingle();
  if (!deal) return { moved: false };
  if (deal.stage_id === target.id) return { moved: false, stage: stageName };

  await admin.from('funnel_deals')
    .update({ stage_id: target.id, updated_at: new Date().toISOString() })
    .eq('id', dealId);

  await admin.from('funnel_deal_history').insert({
    deal_id: dealId,
    from_stage_id: deal.stage_id,
    to_stage_id: target.id,
    changed_by: ctx.ownerId,
    notes: `ERP (${source}${silent ? ', silencioso' : ''}): ${statusText}`,
  }).then(() => {}, () => {});

  if (contactId) {
    await admin.from('gestao_parts_lead_data').update({
      ultimo_status: statusText,
      ultimo_status_em: new Date().toISOString(),
      ...(chaveProcesso ? { chave_processo: chaveProcesso } : {}),
    }).eq('contact_id', contactId).then(() => {}, () => {});
  }

  // Importações, reprocessamentos e sincronizações são silenciosos por padrão.
  // O envio só pode ocorrer quando uma chamada futura o habilitar explicitamente.
  if (silent) {
    console.log('[GP-STATUS] silent transition', JSON.stringify({ dealId, stage: stageName, source }));
    return { moved: true, stage: stageName };
  }

  // Dispara as automações da etapa somente após ativação explícita.
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  await fetch(`${supabaseUrl}/functions/v1/process-funnel-automations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({
      dealId,
      fromStageId: deal.stage_id,
      toStageId: target.id,
      triggerType: 'on_stage_enter',
    }),
  }).catch((e) => console.error('[GP-STATUS] automations error', (e as Error).message));

  return { moved: true, stage: stageName };
}
