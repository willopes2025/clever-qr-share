// Núcleo compartilhado do envio de orçamentos do ERP Gestão Parts.
// Usado pelo envio manual (botão no modal) e pelo job automático de 10 minutos.
// Idempotência: uma linha em `gestao_parts_orcamento_envios` por (empresa, numero).

import { gpCall, normalizePaged, onlyDigits, type GpCreds } from "./gestaoPartsErp.ts";
import { normalizePhone } from "./phone.ts";

// deno-lint-ignore no-explicit-any
type Admin = any;
export type Row = Record<string, unknown>;

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

const money = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const isJunkPhone = (d: string) => /^(\d)\1+$/.test(d);

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
    return local.length === 11 && local[2] === '9';
  });
  const chosen = mobile || valid[0] || '';
  return chosen ? normalizePhone(chosen) : '';
}

export function vendedorNome(row: Row): string {
  for (const key of ['vendedorpedido', 'vendedorfaturamento', 'vendedorcomissionado']) {
    const arr = row[key];
    if (Array.isArray(arr)) {
      for (const entry of arr) {
        const nome = (entry as Row | null)?.['nome'];
        if (nome && String(nome).trim()) return String(nome).trim();
      }
    }
  }
  return pick(row, ['desvendedor', 'vendedor', 'nomevendedor', 'vendedornome', 'codvendedor']);
}


export function orcamentoNumero(row: Row): string {
  return pick(row, ['numpedido', 'numero', 'requisicao', 'pedido']);
}

export function orcamentoEmpresa(row: Row): string {
  return pick(row, ['empresa', 'codempresa']);
}

export function orcamentoTotal(row: Row): number {
  const direct = toNumber(pick(row, ['total', 'valortotal', 'vlrtotal']));
  if (direct) return direct;
  const itens = Array.isArray(row.itens) ? (row.itens as Row[]) : [];
  return itens.reduce((sum, item) => {
    const t = toNumber(pick(item, ['valortotal', 'totalitem', 'valor_total']));
    if (t) return sum + t;
    const q = toNumber(pick(item, ['quantidade', 'qtde', 'qtd']));
    const u = toNumber(pick(item, ['valorunitario', 'valorunit', 'preco']));
    return sum + q * u;
  }, 0);
}

export function orcamentoEmitidoEm(row: Row): string | null {
  const d = pick(row, ['dtemis', 'dtemissao', 'data', 'dtcadastro']);
  if (!d) return null;
  const br = d.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  const iso = br ? `${br[3]}-${br[2]}-${br[1]}` : d.slice(0, 10);
  const hora = pick(row, ['hremis', 'hora', 'hrcadastro']) || '00:00:00';
  const parsed = new Date(`${iso}T${hora.length >= 5 ? hora : '00:00:00'}-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|\s|')([a-zà-ú])/g, (_m, p, c) => p + c.toUpperCase());

export const DEFAULT_TEMPLATE = `Olá {{cliente}}! 👋

Segue o seu orçamento *{{numero}}* emitido em {{data}}:

{{itens}}

*Total: {{total}}*
{{vendedor}}
Qualquer dúvida é só responder por aqui. 😊`;

/** Monta o texto do orçamento a partir do registro do ERP */
export function buildMessage(row: Row, template?: string | null): string {
  const itens = Array.isArray(row.itens) ? (row.itens as Row[]) : [];
  const linhas = itens.slice(0, 25).map((item) => {
    const desc = pick(item, ['descricaoproduto', 'descricao', 'desproduto', 'produto', 'despeca', 'nome']) || 'Item';
    const qtd = toNumber(pick(item, ['quantidade', 'qtde', 'qtd'])) || 1;
    const unit = toNumber(pick(item, ['valorunitario', 'valorunit', 'preco']));
    const tot = toNumber(pick(item, ['valortotal', 'totalitem', 'valor_total'])) || qtd * unit;
    return `• ${desc} — ${qtd.toLocaleString('pt-BR')} x ${money(unit)} = ${money(tot)}`;
  });
  if (itens.length > 25) linhas.push(`• ... e mais ${itens.length - 25} item(ns)`);

  const vendedor = vendedorNome(row);
  const vendedorTxt = vendedor ? `Vendedor: *${titleCase(vendedor)}*\n` : '';

  const nome = pick(row, ['despessoa', 'cliente', 'nome']);
  const emitido = orcamentoEmitidoEm(row);

  return (template || DEFAULT_TEMPLATE)
    .replace(/\{\{cliente\}\}/gi, nome ? titleCase(nome).split(' ')[0] : 'tudo bem')
    .replace(/\{\{numero\}\}/gi, orcamentoNumero(row) || '-')
    .replace(/\{\{data\}\}/gi, emitido ? new Date(emitido).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-')
    .replace(/\{\{itens\}\}/gi, linhas.length ? linhas.join('\n') : 'Itens disponíveis no atendimento.')
    .replace(/\{\{total\}\}/gi, money(orcamentoTotal(row)))
    .replace(/\{\{vendedor\}\}/gi, vendedorTxt)
    // Forma de pagamento removida da mensagem (variável legada vira vazio)
    .replace(/^.*\{\{pagamento\}\}.*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}


/** Vendedor do ERP -> usuário do sistema (de-para cadastrado nas configurações) */
export async function resolveVendedorUser(admin: Admin, vendedor: string): Promise<string | null> {
  const key = String(vendedor || '').trim().toLowerCase();
  if (!key) return null;
  const { data } = await admin
    .from('gestao_parts_vendedores')
    .select('codvendedor, nome, user_id');
  for (const v of (data || []) as Row[]) {
    const cod = String(v.codvendedor ?? '').trim().toLowerCase();
    const nome = String(v.nome ?? '').trim().toLowerCase();
    if ((cod && cod === key) || (nome && (nome === key || key.includes(nome) || nome.includes(key)))) {
      return v.user_id ? String(v.user_id) : null;
    }
  }
  return null;
}

export interface OwnerCtx { ownerId: string; scopeIds: string[] }

export async function resolveOwner(admin: Admin): Promise<OwnerCtx> {
  const { data: integration } = await admin
    .from('integrations').select('user_id')
    .eq('provider', 'gestao_parts').eq('is_active', true).limit(1).maybeSingle();
  const ownerId = String(integration?.user_id || '');
  if (!ownerId) throw new Error('Integração Gestão Parts não configurada');
  const { data: memberIds } = await admin.rpc('get_organization_member_ids', { _user_id: ownerId });
  const scopeIds: string[] = Array.isArray(memberIds) && memberIds.length
    ? memberIds.map((m: unknown) => (typeof m === 'string' ? m : (m as { get_organization_member_ids: string }).get_organization_member_ids))
    : [ownerId];
  if (!scopeIds.includes(ownerId)) scopeIds.push(ownerId);
  return { ownerId, scopeIds };
}

/** Garante contato + conversa (atribuída ao vendedor) para receber o orçamento */
async function ensureConversation(
  admin: Admin,
  ctx: OwnerCtx,
  phone: string,
  nome: string,
  assignedTo: string | null,
): Promise<{ contactId: string; conversationId: string; instance: Row | null }> {
  const { data: existing } = await admin
    .from('contacts').select('id, name')
    .eq('phone', phone).in('user_id', ctx.scopeIds).limit(1).maybeSingle();

  let contactId = existing?.id as string | undefined;
  if (!contactId) {
    const { data: created, error } = await admin.from('contacts').insert({
      user_id: ctx.ownerId,
      phone,
      name: nome ? titleCase(nome) : phone,
      source: 'gestao_parts',
    }).select('id').single();
    if (error) throw new Error(`contato ${phone}: ${error.message}`);
    contactId = created.id as string;
  }

  const { data: conv } = await admin
    .from('conversations')
    .select('id, instance_id, assigned_to, user_id')
    .eq('contact_id', contactId).in('user_id', ctx.scopeIds)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(1).maybeSingle();

  let instance: Row | null = null;
  let conversationId = conv?.id as string | undefined;
  let instanceId = conv?.instance_id as string | undefined;

  if (!instanceId) {
    const { data: connected } = await admin
      .from('whatsapp_instances').select('*')
      .in('user_id', ctx.scopeIds).eq('status', 'connected')
      .neq('is_notification_only', true)
      .limit(1).maybeSingle();
    instance = connected || null;
    instanceId = connected?.id;
  } else {
    const { data: inst } = await admin
      .from('whatsapp_instances').select('*').eq('id', instanceId).maybeSingle();
    instance = inst || null;
  }

  if (!conversationId) {
    const { data: created, error } = await admin.from('conversations').insert({
      user_id: ctx.ownerId,
      contact_id: contactId,
      instance_id: instanceId ?? null,
      assigned_to: assignedTo,
      status: 'open',
    }).select('id').single();
    if (error) throw new Error(`conversa ${phone}: ${error.message}`);
    conversationId = created.id as string;
  } else if (assignedTo && conv?.assigned_to !== assignedTo) {
    // O vendedor do orçamento passa a ser o responsável pela conversa
    await admin.from('conversations').update({ assigned_to: assignedTo }).eq('id', conversationId);
  }


  return { contactId: contactId!, conversationId: conversationId!, instance };
}

export interface SendResult {
  status: 'sent' | 'skipped' | 'failed';
  reason?: string;
  numero: string;
  envioId?: string;
}

/**
 * Envia o orçamento por WhatsApp (Evolution API) garantindo envio único.
 * `force` permite reenvio manual explícito pelo usuário.
 */
export async function sendOrcamento(
  admin: Admin,
  row: Row,
  opts: { origin: 'manual' | 'auto'; force?: boolean; dryRun?: boolean; template?: string | null; ctx?: OwnerCtx; overrideText?: string | null },
): Promise<SendResult> {
  const numero = orcamentoNumero(row);
  const empresa = orcamentoEmpresa(row);
  if (!numero) return { status: 'failed', reason: 'Orçamento sem número', numero: '' };

  const ctx = opts.ctx ?? await resolveOwner(admin);
  const vendedor = vendedorNome(row);
  const assignedTo = await resolveVendedorUser(admin, vendedor);
  const phone = extractPhone(row);
  const nome = pick(row, ['despessoa', 'cliente', 'nome']);

  // Reserva idempotente: só um processo consegue criar a linha
  const { data: reserved, error: reserveError } = await admin
    .from('gestao_parts_orcamento_envios')
    .insert({
      empresa,
      numero,
      serie: pick(row, ['serie']),
      cliente_codigo: pick(row, ['codpessoa', 'codcliente']),
      cliente_nome: nome,
      telefone: phone || null,
      vendedor: vendedor || null,
      assigned_to: assignedTo,
      total: orcamentoTotal(row),
      orcamento_emitido_em: orcamentoEmitidoEm(row),
      origin: opts.origin,
      status: 'processing',
    })
    .select('id')
    .maybeSingle();

  let envioId = reserved?.id as string | undefined;

  if (reserveError) {
    // Já existe registro para este orçamento
    const { data: current } = await admin
      .from('gestao_parts_orcamento_envios')
      .select('id, status')
      .eq('empresa', empresa).eq('numero', numero).maybeSingle();
    if (!current) return { status: 'failed', reason: reserveError.message, numero };
    envioId = current.id as string;
    if (current.status === 'sent' && !opts.force) {
      return { status: 'skipped', reason: 'Orçamento já enviado', numero, envioId };
    }
    if (current.status === 'processing' && !opts.force) {
      return { status: 'skipped', reason: 'Envio em andamento', numero, envioId };
    }
    await admin.from('gestao_parts_orcamento_envios')
      .update({ status: 'processing', error_message: null })
      .eq('id', envioId);
  }

  const fail = async (reason: string) => {
    await admin.from('gestao_parts_orcamento_envios').update({
      status: 'failed',
      error_message: reason.slice(0, 500),
      attempts: (await admin.from('gestao_parts_orcamento_envios').select('attempts').eq('id', envioId).maybeSingle()).data?.attempts + 1 || 1,
    }).eq('id', envioId);
    return { status: 'failed' as const, reason, numero, envioId };
  };

  if (!phone) return await fail('Cliente sem telefone válido no ERP');

  const content = (opts.overrideText && opts.overrideText.trim())
    ? opts.overrideText.trim()
    : buildMessage(row, opts.template);

  if (opts.dryRun) {
    await admin.from('gestao_parts_orcamento_envios')
      .update({ status: 'pending', message_content: content, error_message: 'Modo teste: não enviado' })
      .eq('id', envioId);
    return { status: 'skipped', reason: 'Modo teste', numero, envioId };
  }

  try {
    const { contactId, conversationId, instance } = await ensureConversation(admin, ctx, phone, nome, assignedTo);
    if (!instance || instance.status !== 'connected') {
      return await fail('Nenhuma instância WhatsApp conectada disponível');
    }

    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');
    if (!evolutionUrl || !evolutionKey) return await fail('Evolution API não configurada');

    const remoteJid = `${phone}@s.whatsapp.net`;
    const instanceName = String(instance.evolution_instance_name || instance.instance_name || '');
    const res = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: evolutionKey },
      body: JSON.stringify({ number: remoteJid, text: content }),
    });
    if (!res.ok) return await fail(`WhatsApp recusou o envio: ${(await res.text()).slice(0, 300)}`);
    const sendResult = await res.json().catch(() => ({}));
    const waId = sendResult?.key?.id ? String(sendResult.key.id) : null;

    await admin.from('inbox_messages').insert({
      user_id: assignedTo || ctx.ownerId,
      conversation_id: conversationId,
      contact_id: contactId,
      instance_id: instance.id,
      content,
      message_type: 'text',
      direction: 'outbound',
      status: 'sent',
      remote_jid: remoteJid,
      message_id: waId || `orcamento_${numero}`,
      sent_by_user_id: assignedTo || ctx.ownerId,
      sent_at: new Date().toISOString(),
    });

    await admin.from('conversations').update({
      last_message_at: new Date().toISOString(),
      last_message_preview: content.slice(0, 100),
      last_message_direction: 'outbound',
    }).eq('id', conversationId);

    await admin.from('gestao_parts_orcamento_envios').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      message_content: content,
      whatsapp_message_id: waId,
      contact_id: contactId,
      conversation_id: conversationId,
      telefone: phone,
      assigned_to: assignedTo,
      error_message: null,
    }).eq('id', envioId);

    return { status: 'sent', numero, envioId };
  } catch (e) {
    return await fail((e as Error).message);
  }
}

/** Busca orçamentos no feed v3 do ERP (percorre todos os blocos, em lotes paralelos) */
export async function fetchOrcamentos(
  creds: GpCreds,
  dtinicio: string,
  dtfinal: string,
  maxBlocos = 40,
): Promise<Row[]> {
  const load = async (bloco: number) =>
    normalizePaged(
      await gpCall(creds, 'GET', '/erpssplus/v3/pedido/feed', {
        bloco, tipopedido: ['ORCAMENTO'], dtinicio, dtfinal,
      }),
      ['pedidos'],
    );

  const first = await load(1);
  const out: Row[] = [...first.items];
  const totalReal = Math.max(first.totalblocos || 1, 1);
  // Varre do último bloco real (mais recentes) para trás; o teto limita
  // quantos blocos são lidos, não até onde se lê.
  const menorBloco = Math.max(2, totalReal - maxBlocos + 1);

  const CONCURRENCY = 5;
  for (let start = totalReal; start >= menorBloco; start -= CONCURRENCY) {
    const blocos: number[] = [];
    for (let b = start; b > start - CONCURRENCY && b >= menorBloco; b--) blocos.push(b);
    const pages = await Promise.all(blocos.map((b) => load(b).catch(() => ({ items: [] as Row[], totalblocos: 0 }))));
    // Blocos vazios no meio não interrompem a varredura (o ERP pode ter lacunas)
    for (const p of pages) out.push(...p.items);
  }


  // Dedupe por empresa|numero
  const seen = new Set<string>();
  return out.filter((row) => {
    const key = `${orcamentoEmpresa(row)}|${orcamentoNumero(row)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

