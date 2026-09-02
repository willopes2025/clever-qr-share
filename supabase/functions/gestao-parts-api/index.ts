import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveVendedorUser } from "../_shared/gestaoPartsOrcamento.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GP_DEFAULT_BASE = 'https://api.gestaoparts.com.br';

// Each customer runs their own Gestão Parts/SSPlus server, so the base URL is
// configured per integration (host, port and even scheme can differ).
export interface GpEndpoint {
  secure: boolean;
  hostname: string;
  port: number;
  basePath: string;
  origin: string;
}

function parseEndpoint(rawUrl?: string): GpEndpoint {
  let value = String(rawUrl || '').trim() || GP_DEFAULT_BASE;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    url = new URL(GP_DEFAULT_BASE);
  }

  const secure = url.protocol === 'https:';
  const port = url.port ? Number(url.port) : (secure ? 443 : 80);
  const basePath = url.pathname.replace(/\/+$/, '');
  const hostHeader = url.port ? `${url.hostname}:${url.port}` : url.hostname;

  return { secure, hostname: url.hostname, port, basePath, origin: `${url.protocol}//${hostHeader}` };
}

// ---------------------------------------------------------------------------
// Raw HTTP/HTTPS request helper.
// The Gestão Parts API uses GET requests WITH a JSON body, which the standard
// fetch() API forbids. We therefore speak HTTP/1.1 directly over TCP/TLS.
// ---------------------------------------------------------------------------
async function rawRequest(
  ep: GpEndpoint,
  method: string,
  path: string,
  opts: { headers?: Record<string, string>; body?: string } = {},
): Promise<{ status: number; body: string }> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await rawRequestOnce(ep, method, path, opts);
    } catch (err) {
      lastErr = err;
      const msg = String((err as Error)?.message || err);
      if (!/close_notify|UnexpectedEof|unexpected eof|connection|reset|broken pipe|os error/i.test(msg)) throw err;
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  throw lastErr;
}

async function rawRequestOnce(
  ep: GpEndpoint,
  method: string,
  path: string,
  opts: { headers?: Record<string, string>; body?: string } = {},
): Promise<{ status: number; body: string }> {
  const conn = ep.secure
    ? await Deno.connectTls({ hostname: ep.hostname, port: ep.port })
    : await Deno.connect({ hostname: ep.hostname, port: ep.port });
  try {
    const hostHeader = (ep.secure && ep.port === 443) || (!ep.secure && ep.port === 80)
      ? ep.hostname
      : `${ep.hostname}:${ep.port}`;
    const headers: Record<string, string> = {
      Host: hostHeader,
      Accept: 'application/json',
      'User-Agent': 'WideZap/1.0',
      Connection: 'close',
      ...(opts.headers || {}),
    };


    const bodyBytes = opts.body ? new TextEncoder().encode(opts.body) : null;
    if (bodyBytes) headers['Content-Length'] = String(bodyBytes.byteLength);

    const headerLines = Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n');
    const fullPath = `${ep.basePath}${path.startsWith('/') ? path : `/${path}`}`;
    const head = `${method} ${fullPath} HTTP/1.1\r\n${headerLines}\r\n\r\n`;

    await conn.write(new TextEncoder().encode(head));
    if (bodyBytes) await conn.write(bodyBytes);

    const chunks: Uint8Array[] = [];
    const buf = new Uint8Array(65536);
    let received = 0;
    const decoder = new TextDecoder();
    // Parsing incremental: o cabeçalho é lido uma única vez (evita custo O(n²) em respostas grandes)
    let headerText = '';
    let headerBytes = -1;
    let contentLength = -1;
    let chunkedEnc = false;
    let pending = '';

    const parseHeaderOnce = (chunk: Uint8Array) => {
      if (headerBytes >= 0) return;
      pending += decoder.decode(chunk, { stream: true });
      const idx = pending.indexOf('\r\n\r\n');
      if (idx < 0) return;
      headerText = pending.slice(0, idx);
      headerBytes = new TextEncoder().encode(pending.slice(0, idx + 4)).byteLength;
      chunkedEnc = /transfer-encoding:\s*chunked/i.test(headerText);
      const m = headerText.match(/content-length:\s*(\d+)/i);
      contentLength = m ? Number(m[1]) : -1;
      pending = '';
    };

    const tailIsChunkEnd = () => {
      const tail = chunks.slice(-2);
      const size = tail.reduce((s, c) => s + c.length, 0);
      const merged = new Uint8Array(size);
      let o = 0;
      for (const c of tail) { merged.set(c, o); o += c.length; }
      return /0\r\n\r\n$/.test(new TextDecoder().decode(merged));
    };

    while (true) {
      let n: number | null;
      try {
        n = await conn.read(buf);
      } catch (err) {
        // Some servers close the TLS connection without sending close_notify.
        const msg = String((err as Error)?.message || err);
        if (received > 0 && /close_notify|UnexpectedEof|unexpected eof|connection closed/i.test(msg)) break;
        throw err;
      }
      if (n === null) break;
      const slice = buf.slice(0, n);
      chunks.push(slice);
      received += n;
      parseHeaderOnce(slice);
      if (headerBytes >= 0) {
        if (chunkedEnc) {
          if (tailIsChunkEnd()) break;
        } else if (contentLength >= 0 && received - headerBytes >= contentLength) {
          break;
        }
      }
    }

    const total = chunks.reduce((s, c) => s + c.length, 0);
    const all = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { all.set(c, off); off += c.length; }

    const sepBytes = headerBytes >= 0 ? headerBytes : total;
    const headPart = headerText || new TextDecoder().decode(all.subarray(0, sepBytes));
    const statusLine = headPart.split('\r\n')[0] || '';
    const status = parseInt(statusLine.split(' ')[1] || '0', 10);
    const bodyBytesOut = all.subarray(sepBytes);
    const bodyPart = chunkedEnc
      ? new TextDecoder().decode(decodeChunkedBytes(bodyBytesOut))
      : new TextDecoder().decode(bodyBytesOut);

    return { status, body: bodyPart };
  } finally {
    try { conn.close(); } catch { /* already closed */ }
  }
}

function decodeChunkedBytes(input: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [];
  let i = 0;
  const findCRLF = (from: number) => {
    for (let j = from; j + 1 < input.length; j++) {
      if (input[j] === 13 && input[j + 1] === 10) return j;
    }
    return -1;
  };
  while (i < input.length) {
    const lineEnd = findCRLF(i);
    if (lineEnd < 0) break;
    const size = parseInt(new TextDecoder().decode(input.subarray(i, lineEnd)).trim(), 16);
    if (!Number.isFinite(size) || size === 0) break;
    parts.push(input.subarray(lineEnd + 2, lineEnd + 2 + size));
    i = lineEnd + 2 + size + 2;
  }
  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(totalLen);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

function buildQuery(params: Record<string, unknown> | undefined): string {
  if (!params) return '';
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') usp.append(k, String(v));
  });
  const s = usp.toString();
  return s ? `?${s}` : '';
}

// ---------------------------------------------------------------------------
// Token handling (24h tokens, cached in memory per credential)
// ---------------------------------------------------------------------------
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getToken(ep: GpEndpoint, username: string, password: string, force = false): Promise<string> {
  const cacheKey = `${ep.origin}${ep.basePath}|${username}`;
  const cached = tokenCache.get(cacheKey);
  if (!force && cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const form = new URLSearchParams({ grant_type: 'password', username, password }).toString();
  const res = await rawRequest(ep, 'POST', '/token', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });

  if (res.status !== 200) {
    // Never keep a stale token around after an auth failure
    tokenCache.delete(cacheKey);

    let detail = '';
    try {
      detail = String((JSON.parse(res.body || '{}') as { detail?: unknown }).detail ?? '');
    } catch {
      detail = (res.body || '').slice(0, 300);
    }

    const normalized = detail.toLowerCase();
    if (normalized.includes('não habilitado') || normalized.includes('nao habilitado')) {
      throw new GpError(
        401,
        'Usuário ainda não liberado para a empresa no ERP Gestão Parts. Acione o suporte da Gestão Parts (setor e-commerce/api) para vincular o usuário à empresa.',
        'company_not_enabled',
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new GpError(
        401,
        'Credenciais da Gestão Parts inválidas. Atualize usuário e senha em Configurações → Integrações.',
        'invalid_credentials',
      );
    }
    throw new GpError(res.status, `Falha na autenticação Gestão Parts: ${detail || res.body?.slice(0, 300)}`, 'auth_failed');
  }

  let parsed: { access_token?: string; expires_in?: number };
  try {
    parsed = JSON.parse(res.body);
  } catch {
    throw new GpError(502, `Resposta inválida do /token: ${res.body?.slice(0, 300)}`);
  }

  if (!parsed.access_token) {
    throw new GpError(502, `Token não retornado pela API: ${res.body?.slice(0, 300)}`);
  }

  const ttl = (parsed.expires_in ? Number(parsed.expires_in) : 24 * 3600) * 1000;
  tokenCache.set(cacheKey, { token: parsed.access_token, expiresAt: Date.now() + ttl });
  return parsed.access_token;
}


class GpError extends Error {
  status: number;
  code: string;
  constructor(status: number, message: string, code = 'gp_error') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function gpCall(
  creds: { username: string; password: string; endpoint: GpEndpoint },
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<unknown> {
  const ep = creds.endpoint;
  const doCall = async (token: string) => rawRequest(ep, method, path, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  let token = await getToken(ep, creds.username, creds.password);
  let res = await doCall(token);

  if (res.status === 401 || res.status === 403) {
    console.log('[GestaoParts] Token expirado, renovando...');
    token = await getToken(ep, creds.username, creds.password, true);
    res = await doCall(token);
  }

  if (res.status < 200 || res.status >= 300) {
    throw new GpError(res.status, `Gestão Parts respondeu ${res.status}: ${res.body?.slice(0, 800)}`);
  }

  if (!res.body) return null;
  try {
    return JSON.parse(res.body);
  } catch {
    return { raw: res.body };
  }
}

// Brazilian phone -> DDD + number (API does not expect the 55 country code)
function toErpPhone(phone: string): string {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  return d;
}

function onlyDigits(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}

// The ERP only accepts AAAA-MM-DD; the UI may send DD/MM/AAAA
function toIsoDate(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : s;
}

// bloco is 1-based in the GPASI API; bloco 0 returns nothing
function toBloco(v: unknown): number {
  const n = Number(v ?? 1);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

const PEDIDO_TIPOS = ['ORCAMENTO', 'CONDICIONAL', 'PRE-VENDA', 'E-COMMERCE'];

/** O ERP usa nomes diferentes para o vendedor conforme a rota */
function vendedorNome(row: Record<string, unknown>): string {
  // Feed v3: arrays [{ codigo, nome }]
  for (const key of ['vendedorpedido', 'vendedorfaturamento', 'vendedorcomissionado']) {
    const arr = row[key];
    if (Array.isArray(arr)) {
      for (const entry of arr) {
        const nome = (entry as Record<string, unknown> | null)?.['nome'];
        if (nome && String(nome).trim()) return String(nome).trim();
      }
    }
  }
  for (const key of ['desvendedor', 'vendedor', 'nomevendedor', 'vendedornome', 'codvendedor']) {
    const v = row[key];
    if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
  }
  return '';
}



function normalizeTipos(v: unknown): string[] {
  const list = Array.isArray(v) ? v : String(v ?? '').split(',');
  const normalized = list
    .map((t) => String(t)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase().trim()
      .replace(/\s+/g, '-')
      .replace(/^PRE-?VENDA$/, 'PRE-VENDA')
      .replace(/^E-?COMMERCE$/, 'E-COMMERCE'))
    .filter((t) => PEDIDO_TIPOS.includes(t));
  return normalized.length ? Array.from(new Set(normalized)) : [...PEDIDO_TIPOS];
}

/** Normaliza respostas paginadas do ERP em { items, totalblocos, blocoatual } */
function normalizePaged(raw: unknown, listKeys: string[]): unknown {
  // Algumas rotas (ex: /peca/dados) devolvem [{ totalblocos, blocoatual, pecas: [...] }]
  if (Array.isArray(raw) && raw.length === 1 && raw[0] && typeof raw[0] === 'object'
    && 'totalblocos' in (raw[0] as Record<string, unknown>)) {
    return normalizePaged(raw[0], listKeys);
  }

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    let items: unknown[] | null = null;
    for (const key of listKeys) {
      if (Array.isArray(obj[key])) { items = obj[key] as unknown[]; break; }
    }
    if (!items) {
      for (const value of Object.values(obj)) {
        if (Array.isArray(value)) { items = value as unknown[]; break; }
      }
    }
    return {
      items: items ?? [],
      totalblocos: Number(obj.totalblocos ?? 0),
      blocoatual: Number(obj.blocoatual ?? 0),
      ...(obj.message ? { message: obj.message } : {}),
    };
  }
  if (Array.isArray(raw)) return { items: raw, totalblocos: 1, blocoatual: 1 };
  return { items: [], totalblocos: 0, blocoatual: 0 };
}

function recordsFromPaged(raw: unknown): Record<string, unknown>[] {
  const normalized = normalizePaged(raw, ['clientes', 'cliente']) as { items?: unknown[] };
  return (normalized.items ?? []).filter(
    (item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item),
  );
}

function findPessoaCode(raw: unknown): string {
  const queue: unknown[] = [raw];
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;
    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }
    const obj = current as Record<string, unknown>;
    for (const key of ['codigo', 'codpessoa', 'codcliente']) {
      const value = obj[key];
      if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
    }
    queue.push(...Object.values(obj));
  }
  return '';
}

/**
 * As rotas de busca rápida de peça devolvem uma frase única em `apresenta`
 * ("PD368 - FRASLE - PASTILHA FREIO DIANTEIRA - QTD. 1.000 R$ 179.29")
 * e a imagem inteira em base64. Aqui quebramos isso em colunas utilizáveis.
 */
function parsePecaApresenta(row: Record<string, unknown>): Record<string, unknown> {
  const texto = String(row.apresenta ?? '').trim();
  const base64 = String(row.imgbase64 ?? '').trim();

  let codigo = '';
  let marca = '';
  let descricao = texto;
  let quantidade: number | null = null;
  let preco: number | null = null;

  if (texto) {
    const precoMatch = texto.match(/R\$\s*([\d.,]+)\s*$/);
    if (precoMatch) preco = Number(precoMatch[1].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));

    const qtdMatch = texto.match(/QTD\.\s*([\d.,]+)/i);
    if (qtdMatch) quantidade = Number(qtdMatch[1].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));

    const semCauda = texto.replace(/\s*-\s*QTD\..*$/i, '').trim();
    const partes = semCauda.split(/\s+-\s+/);
    if (partes.length >= 3) {
      codigo = partes[0].trim();
      marca = partes[1].trim();
      descricao = partes.slice(2).join(' - ').trim();
    } else if (partes.length === 2) {
      codigo = partes[0].trim();
      descricao = partes[1].trim();
    } else {
      descricao = semCauda;
    }
  }

  const { imgbase64: _omit, ...rest } = row as Record<string, unknown>;
  return {
    ...rest,
    codigo: row.codigo ?? codigo,
    codigoerp: row.codigoerp ?? row.img ?? '',
    marca: row.marca ?? marca,
    descricao: row.descricao ?? descricao,
    quantidade,
    preco,
    imagem: base64 ? `data:image/jpeg;base64,${base64}` : null,
    apresenta: texto,
  };
}

function mapPecaResult(raw: unknown): unknown {
  const list = Array.isArray(raw)
    ? raw
    : (raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).pecas)
      ? (raw as Record<string, unknown>).pecas as unknown[]
      : null);

  if (!list) return raw;

  const items = list
    .filter((r) => r && typeof r === 'object')
    .map((r) => parsePecaApresenta(r as Record<string, unknown>));

  return { items, totalblocos: 1, blocoatual: 1 };
}



Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  let integrationId: string | null = null;

  try {
    const { action, params = {} } = await req.json();
    console.log(`[GestaoParts] Action: ${action}`, JSON.stringify(params).slice(0, 300));

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });


    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve organization scope so team members share the owner's credentials
    const { data: memberIds } = await supabaseAdmin.rpc('get_organization_member_ids', { _user_id: user.id });
    const scopeIds: string[] = Array.isArray(memberIds) && memberIds.length
      ? memberIds.map((m: unknown) => (typeof m === 'string' ? m : (m as { get_organization_member_ids: string }).get_organization_member_ids))
      : [user.id];
    if (!scopeIds.includes(user.id)) scopeIds.push(user.id);

    const { data: integration } = await supabaseAdmin
      .from('integrations')
      .select('id, credentials, is_active')
      .eq('provider', 'gestao_parts')
      .in('user_id', scopeIds)
      .eq('is_active', true)
      .maybeSingle();

    integrationId = integration?.id ?? null;
    const rawCreds = (integration?.credentials || {}) as Record<string, string>;

    const username = rawCreds.username || Deno.env.get('GESTAO_PARTS_USERNAME') || '';
    const password = rawCreds.password || Deno.env.get('GESTAO_PARTS_PASSWORD') || '';
    const baseUrl = rawCreds.base_url || Deno.env.get('GESTAO_PARTS_BASE_URL') || '';

    if (!username || !password) {
      return new Response(JSON.stringify({ error: 'Integração Gestão Parts não configurada. Cadastre usuário e senha em Configurações → Integrações.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cada cliente possui seu próprio servidor Gestão Parts (host/porta próprios)
    const endpoint = parseEndpoint(baseUrl);
    console.log(`[GestaoParts] Endpoint: ${endpoint.origin}${endpoint.basePath}`);

    const creds = { username, password, endpoint };
    let result: unknown = null;

    switch (action) {
      case 'test_connection': {
        await getToken(endpoint, username, password, true);
        result = { connected: true, endpoint: `${endpoint.origin}${endpoint.basePath}` };
        break;
      }

      // ------- Pessoas / Clientes -------
      case 'check_pessoa': {
        const id = params.telefone
          ? toErpPhone(String(params.telefone))
          : onlyDigits(params.documento || params.id);
        if (!id) throw new GpError(400, 'Informe telefone, CPF ou CNPJ');

        // /pessoas/{id} apenas confirma que a pessoa existe e normalmente devolve
        // código + o próprio termo pesquisado. Use o código encontrado para buscar
        // o cadastro completo na rota de clientes.
        const pessoaRaw = await gpCall(creds, 'GET', `/erpssplus/pessoas/${encodeURIComponent(id)}`);
        const codigo = findPessoaCode(pessoaRaw);
        let clientes: Record<string, unknown>[] = [];

        if (codigo) {
          const clienteRaw = await gpCall(creds, 'GET', '/erpssplus/cliente', {
            bloco: 1,
            codigo,
            cpf: '',
            cnpj: '',
            situacao: 'T',
          });
          clientes = recordsFromPaged(clienteRaw);
        }

        // Fallback para documentos quando a rota de pessoas não devolve código.
        if (!clientes.length && (id.length === 11 || id.length === 14)) {
          const clienteRaw = await gpCall(creds, 'GET', '/erpssplus/cliente', {
            bloco: 1,
            codigo: '',
            cpf: id.length === 11 ? id : '',
            cnpj: id.length === 14 ? id : '',
            situacao: 'T',
          });
          clientes = recordsFromPaged(clienteRaw);
        }

        result = clientes.length
          ? { items: clientes, totalblocos: 1, blocoatual: 1 }
          : { items: [], totalblocos: 0, blocoatual: 0, message: 'Cadastro encontrado, mas o ERP não retornou os dados completos do cliente.' };
        break;
      }

      case 'list_clientes': {
        const raw = await gpCall(creds, 'GET', '/erpssplus/cliente', {
          bloco: toBloco(params.bloco),
          codigo: params.codigo ?? '',
          cpf: onlyDigits(params.cpf) || '',
          cnpj: onlyDigits(params.cnpj) || '',
          situacao: params.situacao ?? 'T',
          ...(params.dtatualizacao ? { dtatualizacao: toIsoDate(params.dtatualizacao) } : {}),
        });
        result = normalizePaged(raw, ['clientes', 'cliente']);
        break;

      }

      case 'cliente_credito': {
        result = await gpCall(creds, 'GET', '/erpssplus/cliente/credito', {
          codigo: params.codigo ?? '',
          cnpj: onlyDigits(params.cnpj || params.cpf) || '',
        });
        break;
      }

      // ------- Peças / Preço / Estoque -------
      // Busca rápida: a API exige `veiculo` preenchido; retorna `apresenta` + imagem base64
      case 'search_peca': {
        const veiculo = String(params.veiculo ?? '').trim();
        const peca = String(params.peca ?? '').trim();
        const codfabricante = String(params.codfabricante ?? '').trim();
        const codbarra = String(params.codbarra ?? '').trim();
        if (!veiculo && !codfabricante && !codbarra) {
          throw new GpError(400, 'Informe o veículo (ou código de fabricante / código de barras) para a busca rápida de peças');
        }
        const raw = await gpCall(creds, 'POST', '/erpssplus/peca', {
          veiculo,
          peca,
          codfabricante,
          codbarra,
          pessoa: params.pessoa ?? '',
        });
        result = mapPecaResult(raw);
        break;
      }

      // Catálogo de produtos com campos estruturados (paginado por bloco).
      // O ERP devolve poucos registros por bloco (~10), então agregamos vários
      // blocos em uma única resposta (padrão 10 blocos = ~100 peças).
      case 'peca_dados': {
        const startBloco = toBloco(params.bloco);
        const maxBlocos = Math.min(Math.max(Number(params.blocos ?? 10) || 10, 1), 30);
        const baseParams = {
          ...(params.codigo ? { codigo: String(params.codigo) } : {}),
          ...(params.marca ? { marca: String(params.marca) } : {}),
          ...(params.grupo ? { grupo: String(params.grupo) } : {}),
          ...(params.subgrupo ? { subgrupo: String(params.subgrupo) } : {}),
          ...(params.secao ? { secao: String(params.secao) } : {}),
          ...(params.habilitadoecommerce ? { habilitadoecommerce: String(params.habilitadoecommerce) } : {}),
          ...(params.dtatualizacao ? { dtatualizacao: toIsoDate(params.dtatualizacao) } : {}),
        };

        const items: unknown[] = [];
        let totalblocos = 0;
        let lastBloco = startBloco;

        for (let i = 0; i < maxBlocos; i++) {
          const bloco = startBloco + i;
          const raw = await gpCall(creds, 'GET', '/erpssplus/peca/dados', { bloco, ...baseParams });
          const page = normalizePaged(raw, ['pecas', 'produtos']) as {
            items: unknown[];
            totalblocos: number;
          };
          items.push(...page.items);
          totalblocos = page.totalblocos || totalblocos;
          lastBloco = bloco;
          if (!page.items.length) break;
          if (totalblocos && bloco >= totalblocos) break;
        }

        result = {
          items,
          totalblocos: totalblocos ? Math.ceil(totalblocos / maxBlocos) : (items.length ? 1 : 0),
          blocoatual: Math.ceil(lastBloco / maxBlocos) || 1,
          blocosbrutos: totalblocos,
        };
        break;
      }


      case 'peca_barcode': {
        const barcode = onlyDigits(params.barcode);
        if (!barcode) throw new GpError(400, 'Informe o código de barras');
        const raw = await gpCall(creds, 'GET', `/erpssplus/peca/codigobarras/${encodeURIComponent(barcode)}`);
        result = mapPecaResult(raw);
        break;
      }


      case 'peca_preco': {
        const cod = String(params.codigoerp || '').trim();
        if (!cod) throw new GpError(400, 'Informe o código ERP da peça');
        result = await gpCall(creds, 'GET', `/erpssplus/peca/preco/${encodeURIComponent(cod)}`);
        break;
      }

      case 'peca_tabela_preco': {
        const raw = await gpCall(creds, 'GET', '/erpssplus/peca/tabela/preco/', {
          bloco: toBloco(params.bloco),
          empresa: params.empresa ?? '',
          codigoerp: params.codigoerp ?? '',
          tabelapreco: params.tabelapreco ?? '',
          ...(params.dtatualizacao ? { dtatualizacao: toIsoDate(params.dtatualizacao) } : {}),
        });
        result = normalizePaged(raw, ['tabelapreco', 'precos', 'pecas']);
        break;

      }

      case 'peca_estoque': {
        const cod = String(params.codigoerp || '').trim();
        if (!cod) throw new GpError(400, 'Informe o código ERP da peça');
        result = await gpCall(creds, 'GET', `/erpssplus/v2/peca/estoque/atual/${encodeURIComponent(cod)}`);
        break;
      }

      case 'peca_veiculo_placa': {
        const placa = String(params.placa || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (!placa) throw new GpError(400, 'Informe a placa');
        // A API espera placa/produto no CORPO da requisição (GET com body)
        const rawPlaca = await gpCall(creds, 'GET', '/erpssplus/v2/peca/veiculo/placa/', {
          placa,
          ...(params.produto ? { produto: String(params.produto) } : {}),
        });
        result = mapPecaResult(rawPlaca);
        break;
      }

      // ------- Pedidos -------
      // Listagem real de pedidos: feed v3 (paginado por bloco, tipos em maiúsculo)
      case 'list_pedidos': {
        const raw = await gpCall(creds, 'GET', '/erpssplus/v3/pedido/feed', {
          bloco: toBloco(params.bloco),
          tipopedido: normalizeTipos(params.tipopedido),
          dtinicio: toIsoDate(params.dtinicio),
          dtfinal: toIsoDate(params.dtfinal),
          // empresa e status também são listas nesta rota
          ...(params.empresa ? { empresa: Array.isArray(params.empresa) ? params.empresa : [String(params.empresa)] } : {}),
          ...(params.status ? { status: Array.isArray(params.status) ? params.status : [String(params.status)] } : {}),

        });
        result = normalizePaged(raw, ['pedidos']);
        break;
      }

      // ------- Orçamentos -------
      // Lista orçamentos por período (agrega blocos) e anexa o status de envio salvo no banco
      case 'list_orcamentos': {
        const maxBlocos = Math.min(Math.max(Number(params.blocos ?? 10) || 10, 1), 60);
        const startBloco = toBloco(params.bloco);
        const empresaParam = params.empresa
          ? { empresa: Array.isArray(params.empresa) ? params.empresa : [String(params.empresa)] }
          : {};

        const loadBloco = async (bloco: number) =>
          normalizePaged(
            await gpCall(creds, 'GET', '/erpssplus/v3/pedido/feed', {
              bloco,
              tipopedido: ['ORCAMENTO'],
              dtinicio: toIsoDate(params.dtinicio),
              dtfinal: toIsoDate(params.dtfinal),
              ...empresaParam,
            }),
            ['pedidos'],
          ) as { items: Record<string, unknown>[]; totalblocos: number };

        const primeiroBloco = (startBloco - 1) * maxBlocos + 1;
        const first = await loadBloco(primeiroBloco);
        const totalblocos = first.totalblocos || 0;
        const ultimoDaPagina = totalblocos
          ? Math.min(primeiroBloco + maxBlocos - 1, totalblocos)
          : primeiroBloco + maxBlocos - 1;

        const items: Record<string, unknown>[] = [...first.items];
        const CONCURRENCY = 5;
        const deadline = Date.now() + 45_000;
        let truncated = false;

        for (let s = primeiroBloco + 1; s <= ultimoDaPagina; s += CONCURRENCY) {
          if (Date.now() > deadline) { truncated = true; break; }
          const blocos: number[] = [];
          for (let b = s; b < s + CONCURRENCY && b <= ultimoDaPagina; b++) blocos.push(b);
          const pages = await Promise.all(
            blocos.map((b) => loadBloco(b).catch(() => ({ items: [], totalblocos: 0 }))),
          );
          // Blocos vazios no meio não interrompem a varredura
          for (const p of pages) items.push(...p.items);
        }

        // Dedupe por empresa + número
        const seen = new Set<string>();
        const unicos = items.filter((row) => {
          const key = `${String(row.empresa ?? '')}|${String(row.numpedido ?? row.numero ?? '')}`;
          if (!key.trim() || seen.has(key)) return key.trim() ? false : true;
          seen.add(key);
          return true;
        });

        const vendedorFiltro = String(params.vendedor || '').trim().toLowerCase();
        const filtered = vendedorFiltro
          ? unicos.filter((row) => vendedorNome(row).toLowerCase().includes(vendedorFiltro))
          : unicos;

        const numeros = filtered.map((r) => String(r.numpedido ?? r.numero ?? '')).filter(Boolean);
        const enviosMap = new Map<string, Record<string, unknown>>();
        if (numeros.length) {
          const { data: envios } = await supabaseAdmin
            .from('gestao_parts_orcamento_envios')
            .select('numero, empresa, status, sent_at, error_message, assigned_to, vendedor')
            .in('numero', numeros.slice(0, 1000));
          for (const e of (envios || []) as Record<string, unknown>[]) {
            enviosMap.set(`${String(e.empresa ?? '')}|${String(e.numero)}`, e);
          }
        }

        const emitidoMs = (row: Record<string, unknown>): number => {
          const d = String(row.dtemis ?? row.dtemissao ?? row.data ?? '').trim();
          if (!d) return 0;
          const br = d.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
          const iso = br ? `${br[3]}-${br[2]}-${br[1]}` : d.slice(0, 10);
          const hora = String(row.hremis ?? row.hora ?? '00:00:00');
          const t = new Date(`${iso}T${hora.length >= 5 ? hora : '00:00:00'}-03:00`).getTime();
          return Number.isNaN(t) ? 0 : t;
        };

        result = {
          items: filtered
            .map((row) => {
              const numero = String(row.numpedido ?? row.numero ?? '');
              const empresa = String(row.empresa ?? '');
              const envio = enviosMap.get(`${empresa}|${numero}`) || enviosMap.get(`|${numero}`) || null;
              return { ...row, vendedor: vendedorNome(row), envio, _emitido: emitidoMs(row) };
            })
            .sort((a, b) => (b._emitido as number) - (a._emitido as number)),
          totalblocos: totalblocos ? Math.ceil(totalblocos / maxBlocos) : (filtered.length ? 1 : 0),
          blocoatual: startBloco,
          truncated,
          vendedores: Array.from(new Set(unicos.map((r) => vendedorNome(r)).filter(Boolean))).sort(),
        };
        break;
      }


      // Busca de um orçamento específico pelo número/requisição
      case 'get_orcamento': {
        const numero = String(params.numero || params.requisicao || '').trim();
        if (!numero) throw new GpError(400, 'Informe o número do orçamento');

        let rows: Record<string, unknown>[] = [];

        // 1) Tenta como "requisição" (token longo do ERP). Números curtos costumam dar 404.
        if (numero.length >= 12) {
          try {
            const raw = await gpCall(creds, 'GET', '/erpssplus/pedido/requisicao', { requisicao: numero });
            const list = normalizePaged(raw, ['pedidos']) as { items: Record<string, unknown>[] };
            rows = list.items || [];
          } catch (_e) {
            rows = [];
          }
        }

        // 2) Fallback: varre o feed de orçamentos procurando pelo nº do pedido
        if (!rows.length) {
          const alvo = numero.replace(/^0+/, '');
          const hoje = new Date();
          const inicio = toIsoDate(params.dtinicio) ||
            new Date(hoje.getTime() - 365 * 86400000).toISOString().slice(0, 10);
          const fim = toIsoDate(params.dtfinal) || hoje.toISOString().slice(0, 10);
          const deadline = Date.now() + 30_000;
          let totalblocos = 0;

          for (let bloco = 1; bloco <= 60; bloco++) {
            if (Date.now() > deadline) break;
            const page = normalizePaged(
              await gpCall(creds, 'GET', '/erpssplus/v3/pedido/feed', {
                bloco,
                tipopedido: ['ORCAMENTO'],
                dtinicio: inicio,
                dtfinal: fim,
                ...(params.empresa ? { empresa: Array.isArray(params.empresa) ? params.empresa : [String(params.empresa)] } : {}),
              }),
              ['pedidos'],
            ) as { items: Record<string, unknown>[]; totalblocos: number };
            totalblocos = page.totalblocos || totalblocos;
            const hit = (page.items || []).filter((r) =>
              String(r.numpedido ?? r.numero ?? '').replace(/^0+/, '') === alvo);
            if (hit.length) { rows = hit; break; }
            if (!page.items?.length || (totalblocos && bloco >= totalblocos)) break;
          }

          if (!rows.length) {
            throw new GpError(404, `Orçamento ${numero} não encontrado no período consultado`, 'not_found');
          }
        }

        const numeros = rows.map((r) => String(r.numpedido ?? r.numero ?? '')).filter(Boolean);
        const { data: envios } = numeros.length
          ? await supabaseAdmin
            .from('gestao_parts_orcamento_envios')
            .select('numero, empresa, status, sent_at, error_message')
            .in('numero', numeros)
          : { data: [] as Record<string, unknown>[] };
        const enviosMap = new Map((envios || []).map((e: Record<string, unknown>) => [String(e.numero), e]));
        result = {
          items: rows.map((row) => ({
            ...row,
            vendedor: vendedorNome(row),
            envio: enviosMap.get(String(row.numpedido ?? row.numero ?? '')) || null,
          })),
          totalblocos: 1,
          blocoatual: 1,
        };
        break;
      }


      // Consulta de status de um pedido específico (nº do pedido ou token)
      case 'get_pedido_status': {
        result = await gpCall(creds, 'GET', '/erpssplus/v2/pedido/status', {
          pedido: params.pedido ?? '',
          dtinicio: toIsoDate(params.dtinicio),
          dtfinal: toIsoDate(params.dtfinal),
          token: params.token ?? '',
        });
        break;
      }

      case 'get_pedido': {
        const requisicao = String(params.requisicao || '').trim();
        if (!requisicao) throw new GpError(400, 'Informe a requisição do pedido');
        result = await gpCall(creds, 'GET', '/erpssplus/pedido/requisicao', { requisicao });
        break;
      }

      case 'pedidos_cpf': {
        const cpf = onlyDigits(params.cpf || params.cnpj);
        if (!cpf) throw new GpError(400, 'Informe o CPF/CNPJ');
        result = await gpCall(creds, 'GET', `/erpssplus/pedido/requisicao/cpf${buildQuery({ cpf })}`);
        break;
      }

      // ------- Financeiro -------
      case 'contas_receber': {
        const raw = await gpCall(creds, 'GET', '/erpssplus/financeiro/contas/receber', {
          bloco: toBloco(params.bloco),
          cliente: params.cliente ?? '',
          empresa: params.empresa ?? '',
          dtemissaoinicio: toIsoDate(params.dtemissaoinicio),
          dtemissaofim: toIsoDate(params.dtemissaofim),
          dtvencimentoinicio: toIsoDate(params.dtvencimentoinicio),
          dtvencimentofim: toIsoDate(params.dtvencimentofim),
          numeroduplicata: params.numeroduplicata ?? '',
          planilha: params.planilha ?? '',
        });
        result = normalizePaged(raw, ['receber']);
        break;

      }

      case 'boletos': {
        if (!params.empresa || !params.planilha) {
          throw new GpError(400, 'Informe empresa e planilha do documento');
        }
        result = await gpCall(creds, 'GET', '/erpssplus/financeiro/contas/receber/boletos', {
          empresa: String(params.empresa),
          planilha: String(params.planilha),
        });
        break;
      }

      case 'empresas': {
        result = await gpCall(creds, 'GET', '/erpssplus/empresa/status');
        break;
      }

      // ------- Resumo para o card do lead -------
      // `lead_summary` só consulta; `lead_sync` também grava o snapshot no card do lead
      case 'lead_summary':
      case 'lead_sync': {
        const telefone = params.telefone ? toErpPhone(String(params.telefone)) : '';
        const telefoneDigits = onlyDigits(params.telefone);
        const telTail = telefoneDigits.length >= 8 ? telefoneDigits.slice(-8) : '';
        const documento = onlyDigits(params.documento);
        const summary: Record<string, unknown> = { pessoa: null, pedidos: [], financeiro: [] };

        const lookupId = documento || telefone;
        if (lookupId) {
          try {
            summary.pessoa = await gpCall(creds, 'GET', `/erpssplus/pessoas/${encodeURIComponent(lookupId)}`);
          } catch (e) {
            console.error('[GestaoParts] lead_summary pessoa:', (e as Error).message);
          }
        }

        const pessoa = summary.pessoa as { codigo?: string; nome?: string; codstatus?: number } | null;
        const clienteCodigo = pessoa?.codigo ? String(pessoa.codigo) : '';

        // Pedidos do cliente: feed v3. O ERP não filtra por cliente, então
        // baixamos o feed do período e filtramos aqui. A varredura começa no
        // ÚLTIMO bloco real (pedidos mais recentes) e desce — o teto limita
        // quantos blocos são lidos, nunca até onde se lê.
        let scanParcial = false;
        if (clienteCodigo || documento || telTail) {
          try {
            const diasParam = Number(params.dias);
            const dias = Number.isFinite(diasParam) && diasParam > 0 ? Math.min(diasParam, 365) : 90;
            const hoje = new Date();
            const inicio = new Date(hoje.getTime() - dias * 86400000);
            const dtinicio = inicio.toISOString().slice(0, 10);
            const dtfinal = hoje.toISOString().slice(0, 10);


            const codigoDigits = onlyDigits(clienteCodigo);
            const matches = (p: Record<string, unknown>) => {
              const cod = onlyDigits(p.codpessoa ?? p.codcliente ?? p.cliente);
              const cpfCnpj = onlyDigits(p.cpfcnpj ?? p.cnpj ?? p.cpf ?? p.documento);
              if (codigoDigits && cod && cod === codigoDigits) return true;
              if (documento && cpfCnpj && cpfCnpj === documento) return true;
              if (telTail) {
                const fones: string[] = [];
                const collect = (value: unknown, depth = 0) => {
                  if (depth > 3 || value == null) return;
                  if (typeof value === 'string' || typeof value === 'number') {
                    const d = onlyDigits(value);
                    if (d.length >= 8) fones.push(d.slice(-8));
                    return;
                  }
                  if (typeof value === 'object') {
                    for (const v of Object.values(value as Record<string, unknown>)) collect(v, depth + 1);
                  }
                };
                collect(p.fones);
                collect(p.telefone);
                collect(p.celular);
                if (fones.includes(telTail)) return true;
              }
              return false;
            };

            const encontrados: Array<Record<string, unknown>> = [];
            const vistos = new Set<string>();
            const MAX_BLOCOS = 60;
            const CONCURRENCY = 6;
            const DEADLINE = Date.now() + 35_000; // evita 504 no gateway

            const fetchBloco = async (bloco: number) => normalizePaged(
              await gpCall(creds, 'GET', '/erpssplus/v3/pedido/feed', {
                bloco,
                tipopedido: PEDIDO_TIPOS,
                dtinicio,
                dtfinal,
              }),
              ['pedidos'],
            ) as { items: Array<Record<string, unknown>>; totalblocos: number };

            const absorve = (items: Array<Record<string, unknown>>) => {
              for (const p of items) {
                if (!matches(p)) continue;
                const key = String(p.numpedido ?? p.numero ?? p.id ?? JSON.stringify(p).slice(0, 120));
                if (vistos.has(key)) continue;
                vistos.add(key);
                encontrados.push(p);
              }
            };

            const first = await fetchBloco(1);
            absorve(first.items);
            const totalReal = Math.max(first.totalblocos || 1, 1);

            // Varre do último bloco REAL (pedidos mais recentes) para trás,
            // lendo no máximo MAX_BLOCOS blocos. Cortar em min(total, teto)
            // fazia a varredura ficar presa nos blocos mais antigos.
            const menorBloco = Math.max(2, totalReal - MAX_BLOCOS + 1);
            const restantes: number[] = [];
            for (let b = totalReal; b >= menorBloco; b--) restantes.push(b);
            if (menorBloco > 2) scanParcial = true;

            for (let i = 0; i < restantes.length; i += CONCURRENCY) {
              if (Date.now() > DEADLINE) { scanParcial = true; break; }
              const lote = restantes.slice(i, i + CONCURRENCY);
              const pages = await Promise.all(
                lote.map((b) => fetchBloco(b).catch(() => ({ items: [], totalblocos: 0 }))),
              );
              for (const page of pages) absorve(page.items);
            }

            if (scanParcial) {
              console.warn('[GestaoParts] lead_sync: varredura parcial', JSON.stringify({ totalReal, menorBloco }));
            }

            // Mais novo -> mais antigo
            const dateKey = (p: Record<string, unknown>) =>
              `${String(p.dtemis ?? '').trim()} ${String(p.hremis ?? '').trim()}`;
            encontrados.sort((a, b) => dateKey(b).localeCompare(dateKey(a)));
            summary.pedidos = encontrados;
            summary.parcial = scanParcial;


          } catch (e) {
            console.error('[GestaoParts] lead_summary pedidos:', (e as Error).message);
          }
        }


        if (clienteCodigo) {
          try {
            summary.financeiro = (normalizePaged(
              await gpCall(creds, 'GET', '/erpssplus/financeiro/contas/receber', {
                bloco: 1,
                cliente: clienteCodigo,
                empresa: '',
                dtemissaoinicio: '',
                dtemissaofim: '',
                dtvencimentoinicio: '',
                dtvencimentofim: '',
                numeroduplicata: '',
                planilha: '',
              }),
              ['receber'],
            ) as { items: unknown[] }).items;
          } catch (e) {
            console.error('[GestaoParts] lead_summary financeiro:', (e as Error).message);

          }

          try {
            summary.credito = await gpCall(creds, 'GET', '/erpssplus/cliente/credito', {
              codigo: clienteCodigo,
              cnpj: documento,
            });
          } catch (e) {
            console.error('[GestaoParts] lead_summary credito:', (e as Error).message);
          }
        }

        if (action === 'lead_sync' && params.contact_id) {
          const novos = (summary.pedidos as Array<Record<string, unknown>>) || [];

          // Mescla com o snapshot anterior: uma varredura parcial nunca pode
          // apagar pedidos que já estavam salvos no cartão.
          const { data: anterior } = await supabaseAdmin
            .from('gestao_parts_lead_data')
            .select('pedidos')
            .eq('contact_id', String(params.contact_id))
            .maybeSingle();

          const chaveP = (p: Record<string, unknown>) =>
            String(p.numpedido ?? p.numero ?? p.id ?? JSON.stringify(p).slice(0, 120));
          const dateKeyP = (p: Record<string, unknown>) =>
            `${String(p.dtemis ?? '').trim()} ${String(p.hremis ?? '').trim()}`;

          const mapa = new Map<string, Record<string, unknown>>();
          for (const p of (anterior?.pedidos as Array<Record<string, unknown>>) || []) mapa.set(chaveP(p), p);
          for (const p of novos) mapa.set(chaveP(p), p);
          const pedidosArr = Array.from(mapa.values())
            .sort((a, b) => dateKeyP(b).localeCompare(dateKeyP(a)));

          const total = pedidosArr.reduce((sum, p) => {
            const v = Number(String(p.total ?? 0).replace(',', '.'));
            return sum + (Number.isFinite(v) ? v : 0);
          }, 0);

          const record = {
            user_id: user.id,
            contact_id: String(params.contact_id),
            deal_id: params.deal_id ? String(params.deal_id) : null,
            lookup_phone: telefoneDigits || null,
            lookup_document: documento || null,
            erp_codigo: clienteCodigo || null,
            erp_nome: pessoa?.nome ? String(pessoa.nome) : null,
            pessoa: summary.pessoa ?? null,
            pedidos: pedidosArr,
            financeiro: summary.financeiro ?? [],
            credito: summary.credito ?? null,
            pedidos_count: pedidosArr.length,
            pedidos_total: total,
            last_synced_at: new Date().toISOString(),
            synced_by: user.id,
          };

          const { data: saved, error: saveError } = await supabaseAdmin
            .from('gestao_parts_lead_data')
            .upsert(record, { onConflict: 'contact_id' })
            .select()
            .maybeSingle();

          if (saveError) console.error('[GestaoParts] lead_sync save:', saveError.message);

          // Carteira: o vendedor do pedido mais recente vira responsável pela
          // conversa do contato — apenas quando ela ainda está sem dono.
          try {
            for (const pedido of pedidosArr.slice(0, 5)) {
              const nomeVendedor = vendedorNome(pedido);
              if (!nomeVendedor) continue;
              const vendedorUserId = await resolveVendedorUser(supabaseAdmin, nomeVendedor);
              if (!vendedorUserId) continue;

              const { data: assigned } = await supabaseAdmin
                .from('conversations')
                .update({ assigned_to: vendedorUserId })
                .eq('contact_id', String(params.contact_id))
                .is('assigned_to', null)
                .select('id');

              if (assigned?.length) {
                console.log('[GestaoParts] carteira: contato', params.contact_id, '->', vendedorUserId, `(${nomeVendedor})`);
                await supabaseAdmin.from('contact_activity_log').insert({
                  contact_id: String(params.contact_id),
                  conversation_id: assigned[0].id,
                  user_id: vendedorUserId,
                  activity_type: 'auto_assign',
                  description: `Lead atribuído ao vendedor ${nomeVendedor} (vínculo do ERP)`,
                  metadata: { origem: 'erp', vendedor: nomeVendedor },
                });
              }
              break;
            }
          } catch (e) {
            console.error('[GestaoParts] carteira lead_sync:', (e as Error).message);
          }

          result = saved ? { ...saved, parcial: scanParcial } : { ...summary, parcial: scanParcial };
          break;
        }


        result = summary;
        break;
      }

      // ------- Nota fiscal (DANFE / XML) -------
      // O ERP não documenta a rota do DANFE; testamos os caminhos conhecidos e
      // devolvemos o primeiro que responder com conteúdo utilizável.
      case 'nfe_documento': {
        const chave = onlyDigits(params.chave);
        if (chave.length !== 44) throw new GpError(400, 'Chave da NF-e inválida (44 dígitos).');
        const formato = String(params.formato || 'pdf').toLowerCase() === 'xml' ? 'xml' : 'pdf';

        const candidates = formato === 'pdf'
          ? [
            `/erpssplus/nfe/danfe/${chave}`,
            `/erpssplus/nfe/${chave}/danfe`,
            `/erpssplus/danfe/${chave}`,
            `/erpssplus/notafiscal/danfe/${chave}`,
          ]
          : [
            `/erpssplus/nfe/xml/${chave}`,
            `/erpssplus/nfe/${chave}/xml`,
            `/erpssplus/notafiscal/xml/${chave}`,
          ];

        const token = await getToken(endpoint, username, password);
        const attempts: Array<{ path: string; status: number }> = [];
        let found: { path: string; content: string; kind: string } | null = null;

        for (const path of candidates) {
          const res = await rawRequest(endpoint, 'GET', path, {
            headers: { Authorization: `Bearer ${token}`, Accept: '*/*' },
          }).catch(() => ({ status: 0, body: '' }));
          attempts.push({ path, status: res.status });
          if (res.status >= 200 && res.status < 300 && res.body && res.body.length > 100) {
            const body = res.body.trim();
            if (formato === 'pdf' && body.startsWith('%PDF')) {
              found = { path, content: btoa(String.fromCharCode(...new TextEncoder().encode(res.body))), kind: 'pdf_base64' };
              break;
            }
            const b64 = body.match(/"([A-Za-z0-9+/=]{500,})"/)?.[1];
            if (b64) { found = { path, content: b64, kind: `${formato}_base64` }; break; }
            if (formato === 'xml' && body.includes('<')) { found = { path, content: body, kind: 'xml' }; break; }
          }
        }

        result = found
          ? { available: true, ...found }
          : { available: false, attempts, message: 'O ERP não expôs uma rota de DANFE/XML para esta chave. Use a consulta no portal da SEFAZ.' };
        break;
      }


      default:
        return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    if (integrationId) {
      await supabaseAdmin.from('integrations').update({ sync_error: null }).eq('id', integrationId);
    }

    return new Response(JSON.stringify({ data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const status = error instanceof GpError ? error.status : 500;
    const code = error instanceof GpError ? error.code : 'unexpected_error';
    const message = error instanceof Error ? error.message : String(error);
    console.error('[GestaoParts] Error:', status, code, message);

    if (integrationId && (code === 'company_not_enabled' || code === 'invalid_credentials' || code === 'auth_failed')) {
      await supabaseAdmin.from('integrations').update({ sync_error: message }).eq('id', integrationId);
    }

    return new Response(JSON.stringify({ error: message, status, code }), {
      status: status >= 400 && status < 600 ? status : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

});
