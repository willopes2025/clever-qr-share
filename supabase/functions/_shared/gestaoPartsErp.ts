// Cliente HTTP mínimo para a API Gestão Parts (SSPlus).
// A API usa GET com corpo JSON, o que fetch() proíbe — falamos HTTP/1.1 direto.

const GP_DEFAULT_BASE = 'https://api.gestaoparts.com.br';

export interface GpEndpoint {
  secure: boolean;
  hostname: string;
  port: number;
  basePath: string;
  origin: string;
}

export function parseEndpoint(rawUrl?: string): GpEndpoint {
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
    await conn.write(new TextEncoder().encode(`${method} ${fullPath} HTTP/1.1\r\n${headerLines}\r\n\r\n`));
    if (bodyBytes) await conn.write(bodyBytes);

    const chunks: Uint8Array[] = [];
    const buf = new Uint8Array(65536);
    let received = 0;
    const decoder = new TextDecoder();
    // Parsing incremental: cabeçalho é lido uma única vez (evita custo O(n²) em respostas grandes)
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

    // Cabeçalho já foi localizado durante a leitura; decodifica corpo em bytes (UTF-8 seguro)
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
    try { conn.close(); } catch { /* já fechado */ }
  }
}

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
    const sizeStr = new TextDecoder().decode(input.subarray(i, lineEnd)).trim();
    const size = parseInt(sizeStr, 16);
    if (!Number.isFinite(size) || size === 0) break;
    parts.push(input.subarray(lineEnd + 2, lineEnd + 2 + size));
    i = lineEnd + 2 + size + 2;
  }
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}


const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export async function getToken(ep: GpEndpoint, username: string, password: string, force = false): Promise<string> {
  const cacheKey = `${ep.origin}${ep.basePath}|${username}`;
  const cached = tokenCache.get(cacheKey);
  if (!force && cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const form = new URLSearchParams({ grant_type: 'password', username, password }).toString();
  const res = await rawRequest(ep, 'POST', '/token', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });

  if (res.status !== 200) {
    tokenCache.delete(cacheKey);
    throw new Error(`Falha na autenticação Gestão Parts (${res.status}): ${(res.body || '').slice(0, 300)}`);
  }

  const parsed = JSON.parse(res.body) as { access_token?: string; expires_in?: number };
  if (!parsed.access_token) throw new Error('Token não retornado pela API Gestão Parts');
  const ttl = (parsed.expires_in ? Number(parsed.expires_in) : 24 * 3600) * 1000;
  tokenCache.set(cacheKey, { token: parsed.access_token, expiresAt: Date.now() + ttl });
  return parsed.access_token;
}

export interface GpCreds { username: string; password: string; endpoint: GpEndpoint }

export async function gpCall(
  creds: GpCreds,
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
    token = await getToken(ep, creds.username, creds.password, true);
    res = await doCall(token);
  }
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Gestão Parts respondeu ${res.status}: ${(res.body || '').slice(0, 500)}`);
  }
  if (!res.body) return null;
  try {
    return JSON.parse(res.body);
  } catch {
    return { raw: res.body };
  }
}

export const PEDIDO_TIPOS = ['ORCAMENTO', 'CONDICIONAL', 'PRE-VENDA', 'E-COMMERCE'];

export function onlyDigits(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}

export function normalizePaged(raw: unknown, listKeys: string[]): { items: Array<Record<string, unknown>>; totalblocos: number; blocoatual: number } {
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
      items: (items ?? []) as Array<Record<string, unknown>>,
      totalblocos: Number(obj.totalblocos ?? 0),
      blocoatual: Number(obj.blocoatual ?? 0),
    };
  }
  if (Array.isArray(raw)) return { items: raw as Array<Record<string, unknown>>, totalblocos: 1, blocoatual: 1 };
  return { items: [], totalblocos: 0, blocoatual: 0 };
}
