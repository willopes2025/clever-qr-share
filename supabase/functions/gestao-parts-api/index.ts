import { createClient } from "npm:@supabase/supabase-js@2";

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
    const isComplete = () => {
      if (received === 0) return false;
      const merged = new Uint8Array(received);
      let o = 0;
      for (const c of chunks) { merged.set(c, o); o += c.length; }
      const text = decoder.decode(merged);
      const sepIdx = text.indexOf('\r\n\r\n');
      if (sepIdx < 0) return false;
      const h = text.slice(0, sepIdx);
      const b = text.slice(sepIdx + 4);
      if (/transfer-encoding:\s*chunked/i.test(h)) return /0\r\n\r\n$/.test(b) || /\r\n0\r\n/.test(b);
      const m = h.match(/content-length:\s*(\d+)/i);
      if (m) return new TextEncoder().encode(b).byteLength >= Number(m[1]);
      return false;
    };

    while (true) {
      let n: number | null;
      try {
        n = await conn.read(buf);
      } catch (err) {
        // Some servers close the TLS connection without sending close_notify.
        // Treat it as a normal EOF when we already have a full response.
        const msg = String((err as Error)?.message || err);
        if (received > 0 && /close_notify|UnexpectedEof|unexpected eof|connection closed/i.test(msg)) break;
        throw err;
      }
      if (n === null) break;
      chunks.push(buf.slice(0, n));
      received += n;
      if (isComplete()) break;
    }


    const total = chunks.reduce((s, c) => s + c.length, 0);
    const all = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { all.set(c, off); off += c.length; }

    const raw = new TextDecoder().decode(all);
    const sep = raw.indexOf('\r\n\r\n');
    const headPart = sep >= 0 ? raw.slice(0, sep) : raw;
    let bodyPart = sep >= 0 ? raw.slice(sep + 4) : '';

    const statusLine = headPart.split('\r\n')[0] || '';
    const status = parseInt(statusLine.split(' ')[1] || '0', 10);

    if (/transfer-encoding:\s*chunked/i.test(headPart)) {
      bodyPart = decodeChunked(bodyPart);
    }

    return { status, body: bodyPart };
  } finally {
    try { conn.close(); } catch { /* already closed */ }
  }
}

function decodeChunked(input: string): string {
  let out = '';
  let i = 0;
  while (i < input.length) {
    const lineEnd = input.indexOf('\r\n', i);
    if (lineEnd < 0) break;
    const size = parseInt(input.slice(i, lineEnd).trim(), 16);
    if (!Number.isFinite(size) || size === 0) break;
    out += input.slice(lineEnd + 2, lineEnd + 2 + size);
    i = lineEnd + 2 + size + 2;
  }
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

      // Catálogo de produtos com campos estruturados (paginado por bloco)
      case 'peca_dados': {
        const raw = await gpCall(creds, 'GET', '/erpssplus/peca/dados', {
          bloco: toBloco(params.bloco),
          ...(params.codigo ? { codigo: String(params.codigo) } : {}),
          ...(params.marca ? { marca: String(params.marca) } : {}),
          ...(params.grupo ? { grupo: String(params.grupo) } : {}),
          ...(params.subgrupo ? { subgrupo: String(params.subgrupo) } : {}),
          ...(params.secao ? { secao: String(params.secao) } : {}),
          ...(params.habilitadoecommerce ? { habilitadoecommerce: String(params.habilitadoecommerce) } : {}),
          ...(params.dtatualizacao ? { dtatualizacao: toIsoDate(params.dtatualizacao) } : {}),
        });
        result = normalizePaged(raw, ['pecas', 'produtos']);
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

        // Pedidos do cliente: feed v3 (últimos 12 meses) filtrado por código, documento ou telefone
        if (clienteCodigo || documento || telTail) {
          try {
            const hoje = new Date();
            const inicio = new Date(hoje.getTime() - 365 * 86400000);
            const feed = normalizePaged(
              await gpCall(creds, 'GET', '/erpssplus/v3/pedido/feed', {
                bloco: 1,
                tipopedido: PEDIDO_TIPOS,
                dtinicio: inicio.toISOString().slice(0, 10),
                dtfinal: hoje.toISOString().slice(0, 10),
              }),
              ['pedidos'],
            ) as { items: Array<Record<string, unknown>> };

            const doDocumento = feed.items.filter((p) => {
              const cod = onlyDigits(p.codpessoa);
              const cpfCnpj = onlyDigits(p.cpfcnpj ?? p.cnpj ?? p.cpf);
              if (clienteCodigo && cod === onlyDigits(clienteCodigo)) return true;
              if (documento && cpfCnpj === documento) return true;
              if (telTail && p.fones && typeof p.fones === 'object') {
                const fones = Object.values(p.fones as Record<string, unknown>)
                  .map((v) => onlyDigits(v))
                  .filter((v) => v.length >= 8);
                if (fones.some((f) => f.slice(-8) === telTail)) return true;
              }
              return false;
            });
            summary.pedidos = doDocumento;
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
          const pedidosArr = (summary.pedidos as Array<Record<string, unknown>>) || [];
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
          result = saved ?? summary;
          break;
        }

        result = summary;
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
