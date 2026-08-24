import { createClient } from "npm:@supabase/supabase-js@2.84.0";

// ── Helpers compartilhados para a API pública ──────────────────────────────
// Usado pela edge function 'public-api'. Autenticação por API key (não JWT).

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

// ── Tipos ─────────────────────────────────────────────────────────────────

export interface AuthContext {
  keyId: string;
  userId: string;
  orgId: string;
  memberIds: string[];
}

export interface ParsedUrl {
  path: string;          // ex.: "/v1/contacts" ou "/v1/contacts/abc-123"
  method: string;        // GET, POST, PATCH, DELETE
  segments: string[];    // ex.: ["v1", "contacts", "abc-123"]
  query: URLSearchParams;
}

// ── Autenticação ──────────────────────────────────────────────────────────

export function createAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );
}

export async function authenticate(req: Request): Promise<AuthContext | Response> {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return sendError(401, "UNAUTHORIZED", "API key ausente. Envie Authorization: Bearer <api_key>.");
  }

  const key = authHeader.slice(7).trim();
  if (!key) {
    return sendError(401, "UNAUTHORIZED", "API key ausente.");
  }

  // Hash SHA-256 da key
  const keyBuffer = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", keyBuffer);
  const keyHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const supabase = createAdminClient();

  // Busca a key no banco
  const { data: keyRow, error: keyError } = await supabase
    .from("api_keys")
    .select("id, user_id, organization_id, expires_at, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (keyError || !keyRow) {
    return sendError(401, "UNAUTHORIZED", "Credencial inválida.");
  }

  // Verifica revogação
  if (keyRow.revoked_at) {
    return sendError(403, "FORBIDDEN", "API key revogada.");
  }

  // Verifica expiração
  if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) {
    return sendError(403, "FORBIDDEN", "API key expirada.");
  }

  // Resolve membros da organização
  const { data: memberRows } = await supabase.rpc("get_organization_member_ids", {
    _user_id: keyRow.user_id,
  });

  const memberIds: string[] = Array.isArray(memberRows) && memberRows.length > 0
    ? memberRows.map((r: string | Record<string, string>) =>
        typeof r === "string" ? r : r.get_organization_member_ids ?? r
      )
    : [keyRow.user_id];

  // Atualiza last_used_at (best-effort)
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id)
    .then(() => {}); // fire-and-forget

  return {
    keyId: keyRow.id,
    userId: keyRow.user_id,
    orgId: keyRow.organization_id,
    memberIds,
  };
}

// ── Rate Limit ────────────────────────────────────────────────────────────

export async function enforceRateLimit(keyId: string): Promise<void | Response> {
  const supabase = createAdminClient();

  // Bucket = minuto atual (janela fixa de 60 req/min)
  const now = new Date();
  now.setSeconds(0, 0);
  const bucketStart = now.toISOString();

  // Autolimpeza: deleta buckets antigos (>2 minutos) — fire-and-forget
  supabase
    .from("api_rate_limit")
    .delete()
    .lt("bucket_start", new Date(Date.now() - 120_000).toISOString())
    .then(() => {})
    .catch(() => {});

  // Incrementa contador no bucket atual
  const { data, error } = await supabase
    .from("api_rate_limit")
    .upsert(
      { key_id: keyId, bucket_start: bucketStart, request_count: 1 },
      { onConflict: "key_id,bucket_start", ignoreDuplicates: false }
    )
    .select("request_count")
    .single();

  if (error) {
    // Se falhou (race condition), incrementa manualmente
    const { data: current } = await supabase
      .from("api_rate_limit")
      .select("request_count")
      .eq("key_id", keyId)
      .eq("bucket_start", bucketStart)
      .maybeSingle();

    if (current && current.request_count >= 60) {
      const resetSeconds = 60 - now.getSeconds();
      return sendError(429, "RATE_LIMITED", "Limite de 60 req/min excedido. Tente novamente em breve.", null, {
        "Retry-After": String(resetSeconds),
        "X-RateLimit-Limit": "60",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(Date.now() / 1000) + resetSeconds),
      });
    }

    await supabase
      .from("api_rate_limit")
      .upsert(
        { key_id: keyId, bucket_start: bucketStart, request_count: (current?.request_count ?? 0) + 1 },
        { onConflict: "key_id,bucket_start" }
      );

    return;
  }

  if (data && data.request_count > 60) {
    const resetSeconds = 60 - now.getSeconds();
    return sendError(429, "RATE_LIMITED", "Limite de 60 req/min excedido. Tente novamente em breve.", null, {
      "Retry-After": String(resetSeconds),
      "X-RateLimit-Limit": "60",
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": String(Math.ceil(Date.now() / 1000) + resetSeconds),
    });
  }
}

// ── Parse de URL ──────────────────────────────────────────────────────────

export function parseUrl(req: Request): ParsedUrl {
  const url = new URL(req.url);
  // Supabase Edge Functions já remove /functions/v1/ do pathname.
  // Ex.: request para /functions/v1/public-api/v1/contacts
  //      → req.url.pathname = /public-api/v1/contacts
  // Precisamos remover apenas /<function-name> (primeiro segmento).
  let path = url.pathname;

  // Remove o nome da function (primeiro segmento após /)
  const segments = path.split("/").filter(Boolean);
  if (segments.length > 0) {
    segments.shift(); // remove "public-api"
    path = "/" + segments.join("/");
  }

  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

  return {
    path,
    method: req.method,
    segments: path.split("/").filter(Boolean),
    query: url.searchParams,
  };
}

// ── Respostas ─────────────────────────────────────────────────────────────

export function sendSuccess(
  status: number,
  data: unknown,
  meta?: Record<string, unknown>,
  extraHeaders?: Record<string, string>
): Response {
  const body: Record<string, unknown> = { data };
  if (meta && Object.keys(meta).length > 0) body.meta = meta;

  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

export function sendError(
  status: number,
  code: string,
  message: string,
  details?: Record<string, string> | null,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({ error: { code, message, ...(details ? { details } : {}) } }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
    }
  );
}

// ── Validação ─────────────────────────────────────────────────────────────

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

// ── Paginação ─────────────────────────────────────────────────────────────

export function parsePagination(query: URLSearchParams): {
  page: number;
  pageSize: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(1, parseInt(query.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.get("page_size") ?? "50", 10) || 50));
  const limit = Math.min(100, Math.max(1, parseInt(query.get("limit") ?? "50", 10) || 50));
  const offset = (page - 1) * pageSize;

  return { page, pageSize, limit, offset };
}

export function buildMeta(
  page: number,
  pageSize: number,
  total: number,
  hasMore: boolean,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  return { page, page_size: pageSize, total, has_more: hasMore, ...extra };
}

export { corsHeaders };
