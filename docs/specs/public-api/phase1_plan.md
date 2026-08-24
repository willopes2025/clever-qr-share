# Plano de Implementação — Fase 1 (Public API: Contatos & Leads)

> **Autor**: Arquiteto sênior WideZap · **Data**: 2026-08-19
> **Base**: `docs/specs/public-api/project_spec.md` (APROVADO) + migrations da Fase 0 + schema real (`src/integrations/supabase/types.ts`)
> **Estilo**: igual à Fase 0 — decisões justificadas, alinhadas ao schema verificado, com notas de risco e rollback.

---

## 0. Onde paramos (Fase 0) e o que falta

A Fase 0 deixou pronta **só a infraestrutura de dados**. Recapitulando o que já existe no banco (verificado em `supabase/migrations/20260819*.sql`):

| Migration | Entrega | Estado |
|---|---|---|
| `20260819120000` | tabela `public.api_keys` (RLS sem policies → só service_role) | ✅ aplicada |
| `20260819120100` | tabela `public.api_rate_limit` (**PK por `key_id`**, não `user_id`) | ✅ aplicada |
| `20260819120200` | `contacts.deleted_at` (soft delete) | ✅ aplicada |
| `20260819120300` | `funnel_deals.deleted_at` (soft delete) | ✅ aplicada |

**O que a Fase 1 precisa entregar (a "cabeça" da API):**
1. O helper compartilhado `supabase/functions/_shared/public-api.ts` (auth + rate limit + envelopes).
2. O gateway `supabase/functions/public-api/index.ts` com as rotas `/v1/contacts` e `/v1/leads` (CRUD completo).
3. Mecanismo de **emissão/revogação** de API keys (decisão 8 do spec).
4. Ajuste de `supabase/config.toml` (`verify_jwt = false` para esta function).
5. Testes smoke (curl/Deno) cobrindo os fluxos e os contratos de erro.

**Princípio norteador (regra de conduta do projeto):** a edge function usa service role **apenas após** validar a API key; a identidade (`user_id`/`organization_id`) vem **exclusivamente** da tabela `api_keys`, **nunca** do body/query. Isso evita a classe de vulnerabilidade `if (!userId && body?.user_id)` que está no hall da fama dos problemas do repo.

---

## 1. Guardrails da Fase 1 (não-negociáveis)

- **Sem `any`**: usar os tipos de `Database` gerados em `src/integrations/supabase/types.ts`. Onde o join for difícil, tipar explicitamente.
- **Filtro de tenant + soft delete em TODA query**: `.in('user_id', memberIds)` + `.is('deleted_at', null)`. Nunca `select('*')` sem filtro.
- **Rate limit por `key_id`** (a migration da Fase 0 é por `key_id`, não `user_id` — ver §3.2). Seguimos a migration, não o texto antigo do spec (5.1b), que citava `user_id`.
- **Não criar duplicação**: reaproveitar o padrão de CORS de `_shared/auth.ts` (`'Access-Control-Allow-Origin': '*'`, headers padrão) e o padrão de cliente do projeto.
- **Lint/build antes de finalizar**: `npm run lint` (aceitar erros pré-existentes de `any`, não aumentar a contagem) e `npm run build`.

---

## 2. Mapa de arquivos (entregáveis)

```
supabase/functions/_shared/public-api.ts        # helpers (auth, rate limit, envelopes, phone)
supabase/functions/public-api/index.ts          # gateway + roteamento + handlers
supabase/functions/admin-create-api-key/index.ts # emissão/revogação de keys (JWT protegido)
supabase/config.toml                            # [functions.public-api] verify_jwt = false
docs/specs/public-api/smoke-tests.md            # cenários de teste manuais/automatizáveis
```

Nenhuma nova migration é necessária — toda a estrutura de dados já existe (Fase 0). Isso é importante: **não editamos migrations antigas**, só consumimos o que foi criado.

---

## 3. `_shared/public-api.ts` — o coração da Fase 1

Este arquivo concentra toda a lógica transversal. Divido em 4 blocos.

### 3.1 Tipos e utilidades base

```ts
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export interface ApiContext {
  keyId: string;          // api_keys.id
  userId: string;         // dono da key (api_keys.user_id) — usado p/ escritas e lookup de funil
  organizationId: string; // api_keys.organization_id
  memberIds: string[];    // get_organization_member_ids(userId) — escopo de leitura
}

export class ValidationError extends Error {
  details: Record<string, string>;
  constructor(details: Record<string, string>) {
    super("VALIDATION_ERROR");
    this.details = details;
  }
}
```

**`normalizePhone(raw: unknown): string`** — aceita qualquer formato, devolve só dígitos.
- Regra (spec 6.2 / decisão 11): mínimo 10 dígitos; aceita DDI opcional (`DDIDDDNNNNNNNNN`), não obriga BR.
- Lança `ValidationError({ phone: "Mínimo 10 dígitos." })` se vazio/inválido.
- Usado tanto no write quanto nas buscas por telefone (spec 3.4/4.3: busca por "contém" em dígitos).

**`sha256Hex(text: string): Promise<string>`** — usa Web Crypto (`crypto.subtle.digest("SHA-256", ...)`), retorna hex. Sem libs externas, sem armazenar plaintext.

### 3.2 `authenticate(req): Promise<{ ctx: ApiContext } | { error: Response }>`

Fluxo (espelha spec 2.3, passo a passo):

1. `Authorization: Bearer <key>` ausente/malformado → **401 UNAUTHORIZED** (`"API key ausente. Envie Authorization: Bearer <api_key>."`).
2. `hash = await sha256Hex(key)`.
3. `select id, user_id, organization_id from api_keys where key_hash = hash and revoked_at is null and (expires_at is null or expires_at > now()) limit 1`.
4. Não achou → **401 UNAUTHORIZED** genérico (`"Credencial inválida."`) — **não** revela se a key existe.
5. Achou → resolve tenant: `memberIds = await rpc('get_organization_member_ids', { _user_id: row.user_id })`. Confirmado em `types.ts:8886` (`Args: { _user_id: string }`, retorna `string[]`).
6. Retorna `ctx = { keyId: row.id, userId: row.user_id, organizationId: row.organization_id, memberIds }`.

> ⚠️ **Decisão de segurança**: a busca usa `key_hash` (SHA-256), idêntico ao padrão de `meta_number_tokens`. A identidade vem da linha da `api_keys`, nunca do body.

### 3.3 `enforceRateLimit(keyId): Promise<{ remaining: number; reset: number } | { error: Response }>`

Alinhado à migration `api_rate_limit` (PK `key_id`, `bucket_start`). Janela fixa de 1s, máx 5 (spec 2.4/6.4, decisão 7 resolvida como **por key**):

1. **Autolimpeza** (evita crescimento infinito sem pg_cron, já previsto no comentário da migration): `delete from api_rate_limit where bucket_start < now() - interval '1 minute'`.
2. `bucket_start = date_trunc('second', now())`.
3. `insert into api_rate_limit (key_id, bucket_start, request_count) values (keyId, bucket_start, 1) on conflict (key_id, bucket_start) do update set request_count = api_rate_limit.request_count + 1 returning request_count`.
4. Se `request_count > 5` → **429 RATE_LIMITED** com `Retry-After: 1` + headers `X-RateLimit-*`.
5. Senão → `{ remaining: 5 - request_count, reset: epoch(bucket_start) + 1 }`.
6. **Best-effort** (não bloqueia): `update api_keys set last_used_at = now() where id = keyId`.

> Nota: a migration usa `key_id`, então o rate limit é **por API key** (cada key tem sua janela). Isso é diferente do texto antigo do spec (5.1b, que citava `user_id`), mas é o que está no banco — Fase 1 segue o banco.

### 3.4 Envelopes de resposta (spec 7)

```ts
export function sendJson(status: number, data: unknown, meta?: object, rate?: RateHeaders): Response
export function sendError(status: number, code: string, message: string, details?: object, rate?: RateHeaders): Response
```

- Success: `{ data, meta? }` (spec 7.1).
- Error: `{ error: { code, message, details? } }` (spec 7.2).
- Headers fixos em toda resposta: `Content-Type: application/json; charset=utf-8`, `Cache-Control: no-store` (dados de CRM não são cacheáveis), CORS `*`, e `X-RateLimit-Limit/Remaining/Reset` quando aplicável. Em 429 também `Retry-After: 1`.

---

## 4. `public-api/index.ts` — o gateway e as rotas

Skeleton padrão do projeto (`Deno.serve` + preflight OPTIONS + `createClient` com service role):

```ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { authenticate, enforceRateLimit, sendJson, sendError, normalizePhone, ValidationError, ApiContext } from "../_shared/public-api.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // 1) Auth
  const auth = await authenticate(req);
  if ("error" in auth) return auth.error;

  // 2) Rate limit (antes de qualquer processamento)
  const rate = await enforceRateLimit(auth.ctx.keyId);
  if ("error" in rate) return rate.error;

  // 3) Roteamento
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/.*\/v1\//, ""); // contacts | leads[/:id]
  try {
    const res = await route(req, url, path, auth.ctx);
    return withRate(res, rate);
  } catch (e) {
    if (e instanceof ValidationError) return sendError(400, "VALIDATION_ERROR", "Dados inválidos.", e.details, rate);
    return sendError(500, "INTERNAL_ERROR", "Erro interno.", undefined, rate);
  }
});
```

### 4.1 Tenant scope — helper interno

Toda query de leitura/escrita parte de:

```ts
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
// leitura: .in("user_id", ctx.memberIds).is("deleted_at", null)
// escrita de contato/lead: user_id = ctx.userId   // dono da key (ver decisão em §4.5)
```

### 4.2 Contatos (spec §3)

| Método | Handler | Lógica resumida |
|---|---|---|
| POST `/v1/contacts` | `createContact` | `normalizePhone`; valida email (regex) se enviado; `value >= 0` n/a; `name` ≤255. Insert com `user_id = ctx.userId`. Conflito em `UNIQUE(user_id, phone)` → **409 DUPLICATE** (`"Contato com este telefone já existe."`). 201 + `{ data, meta:{} }`. |
| GET `/v1/contacts` | `listContacts` | Sem filtro → paginação (`page` 1, `page_size` 50/máx100) `order created_at desc`, `meta {page,page_size,total,has_more}`. |
| GET `/v1/contacts/{id}` | `getContact` | UUID válido senão **400**. `.eq("id", id).in("user_id", memberIds).is("deleted_at", null)`. 0 linhas → **404** (não revela existência). 200 + `{ data }`. |
| GET `/v1/contacts?phone=` | `searchContacts` | `normalizePhone` na query; `.like("phone", `%digits%`)` (contém em dígitos). `limit` 50/máx100/min1. `meta {limit,total,has_more}`. Sem match → `200 data:[]`. |
| GET `/v1/contacts?name=` | `searchContacts` | `ILIKE '%termo%'` com escape de `%`/`_`. `phone`+`name` juntos = AND. |
| PATCH `/v1/contacts/{id}` | `updateContact` | Parcial (decisão 12): só campos presentes. Mesmas validações do POST. 404 se outra conta. 200 + `{ data }`. |
| DELETE `/v1/contacts/{id}` | `deleteContact` | Soft delete: `.update({ deleted_at: now() })`. 404 se inexistente/outra conta. **204 No Content**. Deletar já deletado → **404** (spec 6.3). |

> **Mapeamento de campos expostos (spec 9, item 9):** expor `phone, name, email, notes, status, custom_fields, label_id`. Ocultar `asaas_customer_id`/`asaas_payment_status` (sensíveis). `status` default `active`.

### 4.3 Leads = `funnel_deals` (spec §4)

> ✅ **Correção importante vs spec**: o spec (5.1, item 9) dizia que "lead não tem custom_fields / ignorar". Porém o schema real (`types.ts:4754`) **tem** `funnel_deals.custom_fields` (JSONB). Portanto a Fase 1 **DEVE expor** `custom_fields` no lead, com merge parcial no PATCH (decisão 9.resolve: "expor custom_fields"). Alinhado ao que o app já faz.

| Método | Handler | Lógica resumida |
|---|---|---|
| POST `/v1/leads` | `createLead` | Ver §4.4 (criação automática de contato). 201 + `{ data: { ...lead, contact }, meta:{} }`. |
| GET `/v1/leads` | `listLeads` | Paginação; `order created_at desc`; `meta`. |
| GET `/v1/leads/{id}` | `getLead` | UUID válido senão 400. Join implícito: `funnel_deals` filtrado por `user_id in memberIds` + `deleted_at is null`; retorna também o contato vinculado (`data.contact`). 404 se outra conta. |
| GET `/v1/leads?phone=` / `?name=` | `searchLeads` | Busca **no contato vinculado** (`contacts.phone`/`contacts.name`) dentro do escopo de membros. Lista limitada 50/100/1. |
| GET `/v1/leads?stage_id=` | `listLeads` | Filtra `funnel_deals.stage_id`. |
| PATCH `/v1/leads/{id}` | `updateLead` | Parcial. Se `stage_id` muda → **registra `funnel_deal_history`** (`from_stage_id`, `to_stage_id`, `deal_id`, `changed_by = ctx.userId`) — consistente com o app (spec 4.4). 404 outra conta. 200 + `{ data }`. |
| DELETE `/v1/leads/{id}` | `deleteLead` | Soft delete (`deleted_at`). 204. Já deletado → 404. |

### 4.4 Criação de lead com contato automático (spec §4.1/4.2)

```ts
async function createLead(sb, ctx, body) {
  let contactId: string;

  if (body.contact_id) {
    // valida que o contato é da org
    const { data: c } = await sb.from("contacts")
      .select("id").eq("id", body.contact_id).in("user_id", ctx.memberIds).is("deleted_at", null).maybeSingle();
    if (!c) throw new ApiError(422, "UNRELATED_RESOURCE", "contact_id não pertence à conta.");
    contactId = c.id;
  } else {
    if (!body.phone || !body.name) throw new ValidationError({ phone: "Obrigatório com name.", name: "Obrigatório com phone." });
    const phone = normalizePhone(body.phone);
    // procura contato existente na org por telefone
    const { data: existing } = await sb.from("contacts")
      .select("id").eq("phone", phone).in("user_id", ctx.memberIds).is("deleted_at", null).maybeSingle();
    if (existing) {
      contactId = existing.id; // reutiliza (spec 6.3: não dá 409)
    } else {
      const { data: novo, error } = await sb.from("contacts").insert({
        user_id: ctx.userId, phone, name: body.name,
        email: body.email ?? null, notes: body.notes ?? null, status: "active",
      }).select("id").single();
      if (error) throw error;
      contactId = novo.id;
    }
  }

  // Funil padrão do DONO da key (ver decisão §4.5)
  const { data: funnel } = await sb.from("funnels")
    .select("id").eq("user_id", ctx.userId).eq("is_default", true).maybeSingle();
  if (!funnel) throw new ApiError(422, "FUNNEL_NOT_CONFIGURED", "Conta sem funil padrão configurado.");

  const { data: stage } = await sb.from("funnel_stages")
    .select("id").eq("funnel_id", funnel.id).order("display_order", { ascending: true }).limit(1).maybeSingle();
  if (!stage) throw new ApiError(422, "FUNNEL_NOT_CONFIGURED", "Funil sem estágios.");

  const { data: deal, error } = await sb.from("funnel_deals").insert({
    user_id: ctx.userId, contact_id: contactId, funnel_id: funnel.id, stage_id: stage.id,
    title: body.title ?? body.name, value: body.value ?? 0, currency: body.currency ?? "BRL",
    expected_close_date: body.expected_close_date ?? null, source: body.source ?? null,
    notes: body.notes ?? null, custom_fields: body.custom_fields ?? null,
  }).select("*").single();
  if (error) throw error;

  const { data: contact } = await sb.from("contacts").select("*").eq("id", contactId).single();
  return { ...deal, contact };
}
```

### 4.5 Decisões que a Fase 1 precisa congelar (e o default proposto)

| # | Ponto | Default proposto (justificado) | Onde confirmar |
|---|---|---|---|
| A | `user_id` do contato/lead criado | **`ctx.userId`** (dono da key). Motivo: `funnels` é por `user_id` (`types.ts:5068`), então usar o dono da key mantém coesão no lookup de funil padrão. | spec §4.1 (escopo org p/ leitura; escrita precisa de 1 dono) |
| B | Funil padrão | `funnels WHERE user_id = ctx.userId AND is_default = true` (NÃO por organization_id — o schema não tem `organization_id` em `funnels`). | spec item 13 (resolvido com este mapeamento) |
| C | Rate limit | **Por `key_id`** (segue a migration da Fase 0). | migration `api_rate_limit` |
| D | `custom_fields` em lead | **Expor e fazer merge parcial** (schema real tem o campo). | `types.ts:4754` vs spec 5.1(item9) |
| E | Emissão de key | Edge function `admin-create-api-key` protegida por JWT (ver §5). | spec decisão 8 |

> Itens A/B/C/D/E usam o default se o usuário não objetar. B é a única ressalva real: o spec fala "funil padrão da **organização**", mas o banco só tem funil por **usuário** — por isso propomos usar o dono da key. Se o usuário quiser funil de outro membro, ajustamos para buscar `is_default` entre todos os `memberIds`.

---

## 5. Emissão de API keys — `admin-create-api-key` (decisão 8)

Edge function **protegida por JWT** (reusa `requireUser` de `_shared/auth.ts` — padrão correto do projeto), pois só um usuário logado deve conseguir gerar sua própria key.

```ts
import { requireUser } from "../_shared/auth.ts";
import { sha256Hex } from "../_shared/public-api.ts";

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (!auth.success) return auth.error;
  const userId = auth.userId;

  const body = await req.json().catch(() => ({}));
  // body: { name: string, expires_at?: string }

  const key = "wz_live_" + randomBase62(32);   // crypto.getRandomValues
  const hash = await sha256Hex(key);
  const prefix = key.slice(0, 12);
  const orgId = await rpc("get_user_organization_id", { _user_id: userId }); // types.ts:8920

  await sb.from("api_keys").insert({
    user_id: userId, organization_id: orgId,
    name: body.name, key_hash: hash, key_prefix: prefix,
    expires_at: body.expires_at ?? null,
  });

  // Retorna a plaintext UMA vez (nunca mais recuperável)
  return sendJson(201, { key, prefix, name: body.name });
});
```

- **Revogação**: `PATCH /admin-create-api-key` com `{ key_id }` → `update api_keys set revoked_at = now() where id = key_id and user_id = userId` (só o dono revoga).
- **Alternativa para dev**: um script SQL que chame as mesmas funções (gerar key no cliente, inserir hash). Proposta: edge function como padrão; script SQL apenas para seed local.

---

## 6. `supabase/config.toml`

Adicionar/ajustar a seção da function (mantendo o resto intacto):

```toml
[functions.public-api]
verify_jwt = false
```

Motivo (spec 2.2): a autenticação é por API key, não por JWT do Supabase. A função `admin-create-api-key` **mantém `verify_jwt = true`** (precisa do JWT do dono).

---

## 7. Testes smoke (`docs/specs/public-api/smoke-tests.md`)

Cenários obrigatórios (curl ou Deno fetch), espelhando spec §6.3 e §2.4:

1. **Auth**: sem header → 401; header inválido → 401 genérico; key revogada → 403; key expirada → 403.
2. **Contatos**: criar → 201; buscar por id → 200; duplicar phone → 409; buscar id de outra conta → 404; soft delete → 204; buscar deletado → 404; busca por phone sem match → 200 `data:[]`.
3. **Leads**: criar com `phone`+`name` (sem `contact_id`) → cria contato + deal no funil padrão → 201 com `data.contact`; criar com `contact_id` de outra conta → 422; mover `stage_id` → 200 e linha em `funnel_deal_history`; `FUNNEL_NOT_CONFIGURED` quando a conta não tem funil padrão.
4. **Rate limit**: 6 chamadas no mesmo segundo → 6ª retorna 429 + `Retry-After: 1` + `X-RateLimit-*`.
5. **Multitenant**: key da conta A não enxerga contato/lead da conta B (404).

> Rodar também `npm run lint` e `npm run build` do projeto frontend ao final (a Fase 1 não toca o frontend, mas o build garante que nada quebrou nenhum tipo compartilhado).

---

## 8. Ordem de execução (passos concretos)

1. `supabase/config.toml` → `verify_jwt = false` em `[functions.public-api]`.
2. `_shared/public-api.ts` (§3) — auth, rate limit, envelopes, `normalizePhone`, `sha256Hex`.
3. `public-api/index.ts` (§4) — começar por **Contatos** (mais simples), depois **Leads** (criação automática).
4. `admin-create-api-key/index.ts` (§5).
5. `docs/specs/public-api/smoke-tests.md` + execução dos cenários.
6. `npm run lint` + `npm run build`.
7. (Só se solicitado) commit com mensagem descritiva — **não commitar sem pedido**.

---

## 9. Riscos e pendências explícitas

- 🟠 **Funil por usuário vs organização (item B, §4.5)**: o spec diz "funil padrão da organização", mas `funnels` só tem `user_id`. Decisão proposta = usar o dono da key. Precisa de OK do usuário ou ajuste.
- 🟢 **`custom_fields` em lead**: schema real permite; expomos (corrige o spec). Sem risco.
- 🟢 **Rate limit por key**: segue a migration; coerente.
- 🟢 **Sem nova migration**: Fase 1 consome 100% da infra da Fase 0.
- 🔴 **Segurança**: manter service role **após** validar key; never trust body `user_id`. Reuso de `requireUser` na emissão. Sem `console.log` de key plaintext (só `key_prefix` em logs, se necessário).

---

**Próximo passo após aprovação deste plano:** iniciar pelo item 1 (`config.toml`) e 2 (`_shared/public-api.ts`), na ordem do §8.
