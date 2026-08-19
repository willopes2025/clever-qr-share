import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GP_HOST = 'api.gestaoparts.com.br';
const GP_BASE = `https://${GP_HOST}`;

// ---------------------------------------------------------------------------
// Raw HTTPS request helper.
// The Gestão Parts API uses GET requests WITH a JSON body, which the standard
// fetch() API forbids. We therefore speak HTTP/1.1 directly over TLS.
// ---------------------------------------------------------------------------
async function rawRequest(
  method: string,
  path: string,
  opts: { headers?: Record<string, string>; body?: string } = {},
): Promise<{ status: number; body: string }> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await rawRequestOnce(method, path, opts);
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
  method: string,
  path: string,
  opts: { headers?: Record<string, string>; body?: string } = {},
): Promise<{ status: number; body: string }> {
  const conn = await Deno.connectTls({ hostname: GP_HOST, port: 443 });
  try {
    const headers: Record<string, string> = {
      Host: GP_HOST,
      Accept: 'application/json',
      'User-Agent': 'WideZap/1.0',
      Connection: 'close',
      ...(opts.headers || {}),
    };

    const bodyBytes = opts.body ? new TextEncoder().encode(opts.body) : null;
    if (bodyBytes) headers['Content-Length'] = String(bodyBytes.byteLength);

    const headerLines = Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n');
    const head = `${method} ${path} HTTP/1.1\r\n${headerLines}\r\n\r\n`;

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

async function getToken(username: string, password: string, force = false): Promise<string> {
  const cached = tokenCache.get(username);
  if (!force && cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const form = new URLSearchParams({ grant_type: 'password', username, password }).toString();
  const res = await rawRequest('POST', '/token', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });

  if (res.status !== 200) {
    // Never keep a stale token around after an auth failure
    tokenCache.delete(username);

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
  tokenCache.set(username, { token: parsed.access_token, expiresAt: Date.now() + ttl });
  return parsed.access_token;
}


class GpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function gpCall(
  creds: { username: string; password: string },
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<unknown> {
  const doCall = async (token: string) => rawRequest(method, path, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  let token = await getToken(creds.username, creds.password);
  let res = await doCall(token);

  if (res.status === 401 || res.status === 403) {
    console.log('[GestaoParts] Token expirado, renovando...');
    token = await getToken(creds.username, creds.password, true);
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, params = {} } = await req.json();
    console.log(`[GestaoParts] Action: ${action}`, JSON.stringify(params).slice(0, 300));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

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

    const rawCreds = (integration?.credentials || {}) as Record<string, string>;
    const username = rawCreds.username || Deno.env.get('GESTAO_PARTS_USERNAME') || '';
    const password = rawCreds.password || Deno.env.get('GESTAO_PARTS_PASSWORD') || '';

    if (!username || !password) {
      return new Response(JSON.stringify({ error: 'Integração Gestão Parts não configurada. Cadastre usuário e senha em Configurações → Integrações.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const creds = { username, password };
    let result: unknown = null;

    switch (action) {
      case 'test_connection': {
        await getToken(username, password, true);
        result = { connected: true };
        break;
      }

      // ------- Pessoas / Clientes -------
      case 'check_pessoa': {
        const id = params.telefone
          ? toErpPhone(String(params.telefone))
          : onlyDigits(params.documento || params.id);
        if (!id) throw new GpError(400, 'Informe telefone, CPF ou CNPJ');
        result = await gpCall(creds, 'GET', `/erpssplus/pessoas/${encodeURIComponent(id)}`);
        break;
      }

      case 'list_clientes': {
        result = await gpCall(creds, 'GET', '/erpssplus/cliente', {
          bloco: Number(params.bloco ?? 0),
          codigo: params.codigo ?? '',
          cpf: onlyDigits(params.cpf) || '',
          cnpj: onlyDigits(params.cnpj) || '',
          situacao: params.situacao ?? 'T',
          ...(params.dtatualizacao ? { dtatualizacao: params.dtatualizacao } : {}),
        });
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
      case 'search_peca': {
        result = await gpCall(creds, 'POST', '/erpssplus/peca', {
          veiculo: params.veiculo ?? '',
          peca: params.peca ?? '',
          codfabricante: params.codfabricante ?? '',
          codbarra: params.codbarra ?? '',
          pessoa: params.pessoa ?? '',
        });
        break;
      }

      case 'peca_barcode': {
        const barcode = onlyDigits(params.barcode);
        if (!barcode) throw new GpError(400, 'Informe o código de barras');
        result = await gpCall(creds, 'GET', `/erpssplus/peca/codigobarras/${encodeURIComponent(barcode)}`);
        break;
      }

      case 'peca_preco': {
        const cod = String(params.codigoerp || '').trim();
        if (!cod) throw new GpError(400, 'Informe o código ERP da peça');
        result = await gpCall(creds, 'GET', `/erpssplus/peca/preco/${encodeURIComponent(cod)}`);
        break;
      }

      case 'peca_tabela_preco': {
        result = await gpCall(creds, 'GET', '/erpssplus/peca/tabela/preco/', {
          bloco: Number(params.bloco ?? 0),
          empresa: params.empresa ?? '',
          codigoerp: params.codigoerp ?? '',
          tabelapreco: params.tabelapreco ?? '',
          ...(params.dtatualizacao ? { dtatualizacao: params.dtatualizacao } : {}),
        });
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
        result = await gpCall(creds, 'GET', `/erpssplus/v2/peca/veiculo/placa/${buildQuery({ placa })}`);
        break;
      }

      // ------- Pedidos -------
      case 'list_pedidos': {
        result = await gpCall(creds, 'GET', '/erpssplus/v2/pedido/status', {
          pedido: params.pedido ?? '',
          dtinicio: params.dtinicio ?? '',
          dtfinal: params.dtfinal ?? '',
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
        result = await gpCall(creds, 'GET', '/erpssplus/financeiro/contas/receber', {
          bloco: Number(params.bloco ?? 0),
          cliente: params.cliente ?? '',
          empresa: params.empresa ?? '',
          dtemissaoinicio: params.dtemissaoinicio ?? '',
          dtemissaofim: params.dtemissaofim ?? '',
          dtvencimentoinicio: params.dtvencimentoinicio ?? '',
          dtvencimentofim: params.dtvencimentofim ?? '',
          numeroduplicata: params.numeroduplicata ?? '',
          planilha: params.planilha ?? '',
        });
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
      case 'lead_summary': {
        const telefone = params.telefone ? toErpPhone(String(params.telefone)) : '';
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

        const pessoa = summary.pessoa as { codigo?: string; codstatus?: number } | null;
        const clienteCodigo = pessoa?.codigo ? String(pessoa.codigo) : '';

        if (documento) {
          try {
            summary.pedidos = await gpCall(creds, 'GET', `/erpssplus/pedido/requisicao/cpf${buildQuery({ cpf: documento })}`);
          } catch (e) {
            console.error('[GestaoParts] lead_summary pedidos:', (e as Error).message);
          }
        }

        if (clienteCodigo) {
          try {
            summary.financeiro = await gpCall(creds, 'GET', '/erpssplus/financeiro/contas/receber', {
              bloco: 0,
              cliente: clienteCodigo,
              empresa: '',
              dtemissaoinicio: '',
              dtemissaofim: '',
              dtvencimentoinicio: '',
              dtvencimentofim: '',
              numeroduplicata: '',
              planilha: '',
            });
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

        result = summary;
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify({ data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const status = error instanceof GpError ? error.status : 500;
    const message = error instanceof Error ? error.message : String(error);
    console.error('[GestaoParts] Error:', status, message);
    return new Response(JSON.stringify({ error: message, status }), {
      status: status >= 400 && status < 600 ? status : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
