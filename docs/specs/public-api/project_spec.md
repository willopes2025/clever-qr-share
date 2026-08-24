# Project Spec — Public API (Contatos & Leads)

> Status: **APROVADO** — todas as 13 decisões definidas (Lead=`funnel_deals`, soft delete, Bearer, rate limit por key, limite opcional, telefone `DDIDDDNNNNNNNNN`, PATCH, funil padrão, emissão por admin, custom fields editáveis). Backend: Supabase (Opção A). Atualizado em 2026-08-19.
> Repo: `clever-qr-share` (WideZap/WideIC) · Última atualização: 2026-08-19

---

## 1. Visão geral da feature

### 1.1 Objetivo

Expor uma **API pública REST** para que usuários do WideZap possam consumir e operar dados de **contatos** e **leads** de fora do painel (integrações externas, automações de terceiros, CRMs, ERPs, scripts próprios do cliente).

O cliente se identifica com uma **API key própria** (emitida pelo WideZap), independente do login do painel. Não é OAuth do app nem reuso da sessão do Supabase.

### 1.2 Quem consome

- **Integrações server-to-server** de clientes (ERP/CRM externo, ferramenta de automação).
- **Scripts/CLIs** do próprio cliente.
- **Futuramente**: conectores (Make, Zapier, n8n) — fora desta entrega, mas o formato REST padrão foi desenhado para isso.

### 1.3 Escopo da entrega

**Entra:**
- CRUD completo de contatos (criar, listar/buscar, buscar por ID, atualizar, deletar).
- CRUD completo de leads (mesma estrutura).
- Busca por **ID** (retorna 1 registro), por **telefone** e por **nome** (retorna lista limitada de registros compatíveis).
- Autenticação por API key + rate limit de **60 req/min por API key**.
- Isolamento multi-tenant (cada key só enxerga os dados da sua conta).

**Fica de fora** (ver seção 8): outras entidades, webhooks de saída, painel de gerenciamento de keys, documentação OpenAPI interativa.

### 1.4 Fatos do schema atual (verificados em `supabase/migrations/`)

- `public.contacts` existe (`20251211231704_...:11`): `id, user_id, phone (NOT NULL), name, email, notes, custom_fields JSONB, status, opted_out, last_message_at, created_at, updated_at` + `label_id`, `avatar_url`, `asaas_customer_id`, `asaas_payment_status`.
- **Não existe tabela de leads** em nenhuma migration (nem `api_keys`). `scraped_leads` existe apenas em produção, fora do versionamento — **não deve ser usada** nesta feature.
- `contacts` tem constraint `UNIQUE (user_id, phone)` — duplicidade de telefone por usuário é impossível no banco.
- **Lead = `funnel_deals`** (os "deals" do funil). Schema real (`20251224051201_...:84`): `id, user_id, funnel_id (FK funnels), stage_id (FK funnel_stages), contact_id (FK contacts), conversation_id, title, value (DECIMAL), currency, expected_close_date, closed_at, close_reason_id, source, notes, entered_stage_at, created_at, updated_at`. **`contact_id` é NOT NULL** — todo lead precisa de um contato vinculado (ver regra de criação automática na seção 4).
- `funnels.is_default` marca o funil padrão da conta; `funnel_stages.display_order` define a ordem (primeiro estágio = `display_order` mínimo).
- Nenhuma infraestrutura de API keys existe hoje.

---

## 2. Autenticação e middleware

### 2.1 Identificação do usuário

- Header: **`Authorization: Bearer <api_key>`** (decisão 5 confirmada) — padrão de mercado, mais fácil de consumir por integrações.
- Formato da key: `wz_live_` + 32 caracteres aleatórios (base62/hex, gerada com `crypto.getRandomValues`). Ex.: `wz_live_9f3a...`.
- **Nunca** armazenar a key em texto puro no banco: guardar apenas `key_hash` (SHA-256) + `key_prefix` (primeiros 12 chars, para diagnóstico/logs).
- Uma key pode ter nome (`name`), expiração (`expires_at`) e revogação (`revoked_at`). Um usuário pode ter **várias keys** (rotação por aplicação).

### 2.2 Onde o middleware se encaixa

- **Gateway único**: uma edge function `supabase/functions/public-api/index.ts` que roteia internamente por path (`/v1/contacts...`, `/v1/leads...`). Centraliza auth + rate limit num único ponto público (menos superfície de ataque e contagem de rate limit confiável).
- Helper compartilhado `supabase/functions/_shared/public-api.ts` com:
  - `authenticate(req)` → valida key (hash), resolve `user_id` e `organization_id`, rejeita key revogada/expirada;
  - `enforceRateLimit(keyId)` → janela fixa de 1min, máx 60 req/min por API key;
  - `sendError(status, code, message, details)` → envelope de erro padrão (seção 7).
- Config: `verify_jwt = false` no `supabase/config.toml` para esta function (a autenticação é por API key, não JWT do Supabase). **Regra de conduta do projeto**: a function usa service role apenas DEPOIS de validar a key — a identidade (user_id/org) vem da tabela `api_keys`, **nunca** do body da requisição.

### 2.3 Resolução do tenant (multi-tenancy)

Fluxo do middleware:

1. Extrai `Authorization: Bearer <key>`; ausente → `401`.
2. Calcula `SHA-256(key)` e busca em `api_keys` (`key_hash = hash` e `revoked_at IS NULL` e (`expires_at IS NULL` ou `expires_at > now()`)).
3. Não encontrada → `401` (genérico, não revela se a key existe).
4. Resolve o tenant: `user_id` (dono da key) → `organization_id` (via `organizations.owner_id` ou `team_members` — mesmo padrão do frontend em `src/hooks/useOrganization.ts`).
5. Escopo de dados: **todos os contatos/leads da organização** do dono da key (usuário dono + membros da equipe, via RPC `get_organization_member_ids` — função existente no banco). Decisão 4 confirmada.
6. Aplica rate limit (60 req/min pela `key_id` da requisição — decisão 7).
7. Atualiza `api_keys.last_used_at` (best-effort, sem bloquear a request).

### 2.4 Credencial inválida/ausente/expirada — contrato de erro

| Caso | HTTP | Código | Exemplo de resposta |
|---|---|---|---|
| Header ausente ou malformado | 401 | `UNAUTHORIZED` | `{"error":{"code":"UNAUTHORIZED","message":"API key ausente. Envie Authorization: Bearer <api_key>."}}` |
| Key inexistente | 401 | `UNAUTHORIZED` | `{"error":{"code":"UNAUTHORIZED","message":"Credencial inválida."}}` |
| Key revogada (`revoked_at`) | 403 | `FORBIDDEN` | `{"error":{"code":"FORBIDDEN","message":"API key revogada."}}` |
| Key expirada (`expires_at`) | 403 | `FORBIDDEN` | `{"error":{"code":"FORBIDDEN","message":"API key expirada."}}` |
| Rate limit excedido (60 req/min) | 429 | `RATE_LIMITED` | `{"error":{"code":"RATE_LIMITED","message":"Limite de 60 req/min excedido. Tente novamente em breve."}}` + header `Retry-After` |

Erros 401/403 nunca revelam detalhes internos. Rate limit retorna também `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (ver 7.4).

---

## 3. Endpoints — Contatos

Base: `https://<project>.supabase.co/functions/v1/public-api/v1/contacts`

| Método | Path | Descrição | Autenticação |
|---|---|---|---|
| POST | `/v1/contacts` | Criar contato | API key |
| GET | `/v1/contacts` | Listar (paginado) | API key |
| GET | `/v1/contacts/{id}` | Buscar por ID (retorna **1** registro) | API key |
| GET | `/v1/contacts?phone={phone}` | Buscar por telefone (lista limitada) | API key |
| GET | `/v1/contacts?name={name}` | Buscar por nome (lista limitada) | API key |
| PATCH | `/v1/contacts/{id}` | Atualizar (parcial: só campos enviados) | API key |
| DELETE | `/v1/contacts/{id}` | Deletar | API key |

### 3.1 POST `/v1/contacts` — criar

**Payload (application/json):**

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `phone` | string | ✅ | Obrigatório (constraint do banco). Normalizado para dígitos antes de gravar. Aceita formato internacional `DDIDDDNNNNNNNNN` (com DDI) — não obrigatório BR (decisões 10/11). |
| `name` | string | ❌ | máx 255 chars |
| `email` | string | ❌ | formato e-mail válido se enviado |
| `notes` | string | ❌ | livre |
| `status` | string | ❌ | `active` \| `inactive` (default `active`) |
| `custom_fields` | object | ❌ | objeto chave-valor (JSONB) |
| `label_id` | string | ❌ | exposto (UUID de tag opcional) |

**Sucesso:** `201 Created` + corpo `{"data": {...contato}, "meta": {}}`

**Erros:**
- `400 VALIDATION_ERROR` — campo inválido (ex.: e-mail malformado, phone vazio), `details` lista os campos.
- `409 DUPLICATE` — já existe contato com o mesmo `phone` na conta. `{"error":{"code":"DUPLICATE","message":"Contato com este telefone já existe."}}`
- `422` — falha de regra de negócio (ver 6.4).

### 3.2 GET `/v1/contacts` — listar

Query params: `page` (default 1), `page_size` (default 50, máx 100), `limit` (opcional; default 50, máx 100, min 1 — usado em buscas por filtro, decisão 6).
Ordem: `created_at DESC`. Sucesso: `200` + `{"data": [...], "meta": {page, page_size, total, has_more}}`.

### 3.3 GET `/v1/contacts/{id}` — buscar por ID

- `{id}` = UUID do contato.
- **Retorna exatamente 1 registro** (o do ID) ou `404 NOT_FOUND` (inclusive se o contato existir mas pertencer a outra conta — não vazar existência).
- Sucesso: `200` + `{"data": {...}}`.

### 3.4 GET `/v1/contacts?phone={phone}` e `?name={name}` — buscar

- **Phone**: normaliza a query para dígitos e busca compatibilidade parcial por **contém** (dígitos) no telefone armazenado (decisão 10). Aceita `DDIDDDNNNNNNNNN`/internacional.
- **Name**: busca parcial, case-insensitive (`ILIKE '%termo%'`, com escape de `%`/`_`).
- `phone` + `name` juntos = **AND**.
- **Retorna lista limitada**: `limit` default 50, máx 100, min 1 (decisão 6) — nunca retorna tudo.
- Sucesso: `200` + `{"data": [...], "meta": {limit, total, has_more}}`.
- Nenhum filtro informado → comportamento de listagem paginada (3.2).

### 3.5 PATCH `/v1/contacts/{id}` — atualizar

- Atualização **parcial** (decisão 12): apenas os campos presentes no body são alterados.
- Mesmas validações do POST por campo.
- `404` se não existe/outra conta. Sucesso: `200` + `{"data": {...contato atualizado}}`.

### 3.6 DELETE `/v1/contacts/{id}`

- `204 No Content` em sucesso.
- `404` se não existe/outra conta.
- **Atenção**: `contacts` é referenciado por `conversations.contact_id`, `funnel_deals.contact_id`, `contact_tags` (FKs nas migrations). Decisão 3 confirmada: **soft delete** (`deleted_at`) para não quebrar histórico de conversas/funil.

---

## 4. Endpoints — Leads (mapeia para `funnel_deals`)

> **Decisão:** "Lead" na API pública **é o `funnel_deals`** (o deal que vive dentro do funil). Não será criada tabela nova de leads. O recurso Lead expõe os campos de `funnel_deals` (+ o contato vinculado em `data.contact`).

Base: `https://<project>.supabase.co/functions/v1/public-api/v1/leads`

| Método | Path | Descrição |
|---|---|---|
| POST | `/v1/leads` | Criar lead (deal). Sem `contact_id` → cria contato automaticamente |
| GET | `/v1/leads` | Listar (paginado) |
| GET | `/v1/leads/{id}` | Buscar por ID (retorna **1** registro) |
| GET | `/v1/leads?phone={phone}` | Buscar por telefone do contato vinculado (lista limitada) |
| GET | `/v1/leads?name={name}` | Buscar por nome do contato vinculado (lista limitada) |
| GET | `/v1/leads?stage_id={id}` | Filtrar por estágio do funil |
| PATCH | `/v1/leads/{id}` | Atualizar (parcial) |
| DELETE | `/v1/leads/{id}` | Soft delete |

### 4.1 Relação lead ↔ contato (definida)

- **1 Lead (`funnel_deals`) → 1 Contato (`contacts`)** via FK `funnel_deals.contact_id` (NOT NULL). A API **sempre** retorna o contato vinculado em `data.contact` (ou `data.contact_id`).
- **Criação automática de contato (apenas no POST):**
  - Se `contact_id` **for** informado: validar que o contato existe **na mesma conta** → senão `422`.
  - Se `contact_id` **não** for informado: a requisição **deve** conter `phone` + `name` (ambos obrigatórios neste caso). A API então:
    1. Normaliza o telefone e **procura** um contato existente na conta com aquele `phone` (`UNIQUE (user_id, phone)`); se achar, reutiliza.
    2. Se não achar, **cria** o contato (`phone`, `name`, `email?`, `notes?` do body do lead) com `status='active'`.
    3. Cria o `funnel_deals` vinculado a esse contato, no **funil padrão principal** da organização e no **primeiro estágio** (decisão 13 — ver 4.2).
- Não há conversão "lead → contato" separada: o lead já é sempre um deal atrelado a um contato. Mover o deal entre estágios (incluindo estágios de ganho/perda `final_type`) é feito via `PUT /v1/leads/{id}` com `stage_id`.

### 4.2 POST `/v1/leads` — criar

**Payload A — com contato existente:**

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `contact_id` | UUID | ✅ (ou `phone`+`name`) | contato deve existir na mesma conta |
| `title` | string | ❌ | título do deal; default = nome do contato |
| `value` | number | ❌ | `>= 0`, 2 casas (`DECIMAL(12,2)`) |
| `currency` | string | ❌ | default `BRL` |
| `stage_id` | UUID | ❌ | estágio do funil; se omitido usa o primeiro do funil padrão |
| `expected_close_date` | date | ❌ | `YYYY-MM-DD` |
| `source` | string | ❌ | origem do lead |
| `notes` | string | ❌ | livre |
| `custom_fields` | object | ❌ | editável (decisão 9) — `funnel_deals.custom_fields` é JSONB desde `20251224053036`; PATCH faz merge parcial das chaves |

**Payload B — sem contato (criação automática obrigatória):**

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `phone` | string | ✅ | obrigatório neste modo; normalizado |
| `name` | string | ✅ | obrigatório neste modo |
| `email` | string | ❌ | formato válido |
| `title`, `value`, `currency`, `stage_id`, `expected_close_date`, `source`, `notes` | — | ❌ | mesmas regras do Payload A |

**Resposta:** `201` + `{"data": {lead..., "contact": {...contato}}, "meta": {}}`.

**Erros:**
- `400 VALIDATION_ERROR`: modo sem `contact_id` mas faltando `phone` ou `name`.
- `422 UNRELATED_RESOURCE`: `contact_id` informado não pertence à conta.
- `422 FUNNEL_NOT_CONFIGURED`: conta sem funil padrão nem estágios (impede criar deal) — decisão 13.

### 4.3 GET `/v1/leads/{id}` / `?phone=` / `?name=` / `?stage_id=` / listagem

- `/v1/leads/{id}` → **1 registro** (o do ID) ou `404` (inclusive outra conta).
- `/v1/leads?phone=` e `?name=` → busca **no contato vinculado** (`contacts.phone`/`contacts.name`), lista limitada compatível (default 50 / máx 100, min 1 — decisão 6), normalização de telefone e `ILIKE` no nome.
- `?stage_id=` → filtra deals daquele estágio.
- Listagem paginada (`page`/`page_size`) ordenada por `created_at DESC`, com `meta`.

### 4.4 PATCH `/v1/leads/{id}` e DELETE

- `PATCH` (decisão 12): atualização parcial dos campos do deal (`title`, `value`, `currency`, `stage_id`, `expected_close_date`, `source`, `notes`, `custom_fields`). Se `stage_id` mudar, registra em `funnel_deal_history` (consistente com o app). `404` se outra conta.
- `DELETE`: **soft delete** (marca `deleted_at`, não remove a linha — ver 5.1c). `204 No Content`. Listagens/GETs ignoram registros com `deleted_at IS NOT NULL`.

---

## 5. Modelagem de dados

### 5.1 Tabelas novas (3 migrations novas, padrão `YYYYMMDDHHMMSS_<uuid>.sql` — nunca editar migrations existentes)

**a) `public.api_keys`** — chaves de acesso à API

```sql
CREATE TABLE public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,            -- SHA-256 hex da key (nunca texto puro)
  key_prefix TEXT NOT NULL,                 -- ex.: 'wz_live_9f3a' para logs/diagnóstico
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,                   -- NULL = sem expiração
  revoked_at TIMESTAMPTZ                    -- NULL = ativa
);
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
-- Sem policies para anon/authenticated (acesso apenas via service role na edge function).
-- Padrão já usado no projeto: `meta_number_tokens` (service-role only).
```

**b) `public.api_rate_limit`** — janela fixa de 1s para rate limit

```sql
CREATE TABLE public.api_rate_limit (
  key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  bucket_start TIMESTAMPTZ NOT NULL,        -- start of second (date_trunc('second', now()))
  request_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (key_id, bucket_start)
);
ALTER TABLE public.api_rate_limit ENABLE ROW LEVEL SECURITY;
-- Sem policies (service-role only). Autolimpeza: o enforcement (Fase 1) deleta
-- buckets antigos (bucket_start < now() - '1 minute') antes de contar.
```

**c) Soft delete em `contacts` e `funnel_deals`** — não será criada tabela de leads

O recurso "Lead" é o `funnel_deals` existente; só adicionamos soft delete (decisão confirmada pelo dono):

```sql
-- contacts: soft delete
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_contacts_deleted_at ON public.contacts(deleted_at);

-- funnel_deals: soft delete
ALTER TABLE public.funnel_deals
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_funnel_deals_deleted_at ON public.funnel_deals(deleted_at);
```

- Todas as queries da API filtram `deleted_at IS NULL` (hard delete **não** é usado).
- RLS das tabelas já existe (policies por `auth.uid() = user_id`); a edge function com service role respeita o filtro de tenant + soft delete.
- **Custom fields**: `contacts.custom_fields` (JSONB desde `20251211231704`) e `funnel_deals.custom_fields` (JSONB desde `20251224053036`) são expostos e **totalmente editáveis** via PATCH (merge parcial das chaves) — decisão 9.

### 5.2 Isolamento multi-tenant no nível do banco

- **Defesa em profundidade (2 camadas)**:
  1. A edge function usa **service role**, mas a identidade/tenant vêm **exclusivamente da API key validada** (`api_keys.user_id`/`organization_id`) — nunca do body. Todas as queries filtram por `member_ids` (org) ou `user_id`.
  2. RLS habilitado em todas as tabelas novas, **sem policies abertas** para `anon`/`authenticated` (padrão "service-role only" já existente no projeto — regra de conduta: nenhuma policy nomeada "Service role can..." sem `TO service_role`; aqui nem policy será criada).
- Acesso cross-tenant é impossível por design: a resolução do tenant acontece no middleware, e o filtro SQL é aplicado em todas as queries (nunca `select('*')` sem filtro).

---

## 6. Regras de negócio e casos de uso

### 6.1 Casos de uso principais

1. **Sincronização externa**: ERP do cliente envia `POST /v1/contacts` para manter a base do WideZap atualizada.
2. **Captura de leads (deal) de fonte externa**: formulário/site externo envia `POST /v1/leads` com `phone`+`name` → a API **cria o contato automaticamente** (se não houver) e já gera o deal no funil padrão (caso de uso principal da integração).
3. **Qualificação**: script externo consulta `GET /v1/leads?phone=` para verificar se um telefone já é lead/contato antes de inserir (evita duplicidade).
4. **Movimentação no funil**: integração move o deal de estágio via `PUT /v1/leads/{id}` com `stage_id` (ex.: marcar como ganho/perda usando os estágios `final_type`).
5. **Enriquecimento**: busca contato por nome (`GET /v1/contacts?name=`) e atualiza via `PUT`.

### 6.2 Validações

- `phone`: obrigatório; normalizado para dígitos; aceita formato internacional `DDIDDDNNNNNNNNN` com DDI — não obrigatório BR (decisões 10/11). Mínimo 10 dígitos.
- `email`: formato válido se enviado; opcional (contato sem e-mail é permitido — caso de borda documentado).
- `name`: opcional; se vazio, aceito (`NULL`).
- `custom_fields`: objeto JSON, máx ~10 KB. Editável via merge parcial no PATCH (decisão 9).
- IDs (path): devem ser UUID válidos, senão `400 VALIDATION_ERROR`.

### 6.3 Duplicidade e casos de borda

| Caso | Comportamento |
|---|---|
| POST contato com `phone` já existente na conta | `409 DUPLICATE` (constraint `UNIQUE (user_id, phone)`) |
| POST lead sem `contact_id` mas faltando `phone`/`name` | `400 VALIDATION_ERROR` |
| POST lead com `contact_id` de outra conta | `422 UNRELATED_RESOURCE` |
| POST lead (modo automático) recria contato se `phone` já existe | **Reutiliza** o contato existente (não `409`) |
| GET por ID de recurso de outra conta | `404` (não revelar existência) |
| Contato sem `email` | Permitido (`201`/`200` normal) |
| Busca por telefone sem correspondência | `200` com `data: []` (lista vazia, nunca 404) |
| Busca por nome com `%`/`_` no termo | Escapados (busca literal) |
| PATCH em recurso inexistente / outra conta | `404` |
| DELETE (soft) em recurso já deletado | `404` |
| Mais de 60 requisições no mesmo minuto | `429` + `Retry-After` |

### 6.4 Rate limiting (60 req/min)

- **Janela fixa de 1 minuto**, contagem por `key_id` (decisão 7 — por API key, não por usuário).
- Implementação: `INSERT ... ON CONFLICT (key_id, bucket_start) DO UPDATE SET request_count = api_rate_limit.request_count + 1 RETURNING request_count`; se `> 60` → `429`.
- Verificado **antes** de qualquer processamento (auth primeiro, rate limit em seguida).
- Headers em toda resposta: `X-RateLimit-Limit: 60`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (epoch do fim da janela).
- Autolimpeza: antes de contar, o enforcement deleta buckets com `bucket_start < now() - '2 minutes'` — sem necessidade de pg_cron.

---

## 7. Formato de resposta e padrões

### 7.1 Envelope de sucesso

```json
{
  "data": { ... },              // objeto (1 registro) ou array (listagem)
  "meta": {                     // presente em listagens/buscas
    "page": 1,
    "page_size": 50,
    "limit": 50,                // quando busca com filtro
    "total": 137,
    "has_more": true
  }
}
```

### 7.2 Envelope de erro

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Mensagem legível para o cliente.",
    "details": { "phone": "Campo obrigatório." }   // opcional; campos com problema
  }
}
```

### 7.3 Códigos de status usados

`200` (ok) · `201` (created) · `204` (deleted) · `400` (validação) · `401` (key ausente/inválida) · `403` (key revogada/expirada) · `404` (não existe/outra conta) · `409` (duplicidade) · `422` (regra de negócio) · `429` (rate limit) · `500` (erro interno, sem detalhes no body).

### 7.4 Headers

- `Content-Type: application/json; charset=utf-8`
- Rate limit: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`; em 429 também `Retry-After`.
- `Cache-Control: no-store` (dados de CRM não devem ser cacheados).
- CORS: API server-to-server; CORS `*` sem credentials é suficiente (não há cookies).

### 7.5 Versionamento

- Versão no path: `/v1/`. Mudanças que quebram compatibilidade exigem `/v2/` (o `/v1/` permanece ativo até migração dos clientes).
- Campo `X-API-Version` não é necessário nesta entrega (path já resolve).

---

## 8. Fora de escopo / próximos passos

**Fora desta entrega (sem ambiguidade):**
1. UI do painel para autoatendimento de criar/revogar/renomear API keys — emissão inicial é via admin (decisão 8).
2. Endpoints de outras entidades (campanhas, inbox, instâncias, funil, templates).
3. Webhooks de saída (notificar cliente sobre eventos) — próxima feature natural.
4. Documentação OpenAPI/Swagger interativa e portal de desenvolvedores.
5. OAuth2/OIDC e refresh tokens — autenticação é exclusivamente por API key (Bearer).
6. Rate limit por IP ou por plano (é por API key, 60 req/min fixo — decisão 7).
7. Exposição de `scraped_leads` ou dados de busca de leads (IBGE/CNPJ) — entidade própria, fora do CRUD de leads.
8. Sincronização bidirecional com o app (ex.: leads criados pela API aparecerem numa tela de leads do painel — não existe tela de leads hoje; seria uma feature separada).

**Próximos passos sugeridos (após esta entrega):**
- Painel de gerenciamento de API keys (UI) + auditoria de uso (`last_used_at`, logs).
- Webhooks de saída com assinatura HMAC.
- OpenAPI + exemplos por linguagem.
- Extensão do rate limit por plano (planos maiores ganham mais req/s).
- Domínio personalizado para a API pública (ex.: `api.widezap.com.br`) — ver seção 10.

---

## 9. Decisões da feature (todas resolvidas)

Todas as ambiguidades da versão inicial foram fechadas com o dono do produto. Resumo:

| # | Decisão | Valor final |
|---|---|---|
| 1 | Lead | = `funnel_deals` (deal do funil) |
| 2 | Lead↔Contato | `POST /v1/leads` sem `contact_id` cria/recupera contato via `phone`+`name` e gera o deal |
| 3 | DELETE | Soft delete (`deleted_at`) em `contacts` e `funnel_deals` |
| 4 | Escopo | Key acessa toda a organização do dono |
| 5 | Header | `Authorization: Bearer <api_key>` |
| 6 | Limite | `?limit=` opcional, default 50, máx 100, min 1 |
| 7 | Rate limit | por API key |
| 8 | Emissão de key | apenas admin da conta |
| 9 | Custom fields | ambos (`contacts` e `funnel_deals`) expõem `custom_fields` JSONB editável (merge parcial) |
| 10/11 | Telefone | formato `DDIDDDNNNNNNNNN`; internacional permitido (não obrigatório BR) |
| 12 | Update | `PATCH` |
| 13 | Funil | funil padrão principal da conta se não informado |

Backend: **Supabase** (edge function + Postgres) — Opção A confirmada.

---

## 10. Ambiente de Homologação & Testes Pré-Prod

**Decisão:** testar contra dados de produção sem risco de quebra — **Caminho 2** (deploy aditivo em prod + key privada).

### Por que é seguro

As migrations são 100% aditivas (novas tabelas + coluna nullable `deleted_at`); a API é uma nova edge function isolada (`verify_jwt=false` só para ela); o app atual não a chama. Deploy em prod não altera fluxo existente.

### Fluxo de validação antes de expor a key a clientes

1. **Aplicar em prod (aditivo):** `supabase link --project-ref fgbenetdksqnvwkgnips` → `supabase db push` (cria `api_keys`, `api_rate_limit`, `deleted_at`).
2. **Deploy da function:** `supabase functions deploy public-api` (usa `config.toml` → `verify_jwt=false`).
3. **Setar secrets por projeto:** `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...` (por projeto, não compartilhado).
4. **Emitir API key de teste restrita ao seu `user_id`** (via admin/Fase 3) e chamar `https://fgbenetdksqnvwkgnips.supabase.co/functions/v1/public-api/v1/contacts` com `curl`/Postman.
5. **Smoke (Fase 4):** auth 401/403/429; CRUD contatos; CRUD leads com criação automática de contato; isolamento cross-tenant → 404; soft delete; rate limit 60 req/min.
6. **Expor a clientes** somente após o smoke passar.

### Domínio personalizado

A URL padrão das Edge Functions é `https://<project-ref>.supabase.co/functions/v1/public-api`. Para expor com domínio customizado (ex.: `api.widezap.com.br`):

1. **Supabase Custom Domains** (funcionalidade nativa do plano Team/Enterprise do Supabase):
   - No painel Supabase → Project Settings → Networking → Custom Domains.
   - Adicionar `api.widezap.com.br` e configurar o registro CNAME (`api.widezap.com.br` → `cname.vercel-dns.com` ou similar, conforme instruções do painel).
   - O Supabase gera automaticamente um certificado SSL (Let's Encrypt).
   - Após propagação (5–30 min), a API fica acessível em `https://api.widezap.com.br/functions/v1/public-api/v1/...`.

2. **Alternativa: Vercel/Cloudflare Reverse Proxy** (se o plano Supabase não suportar custom domain):
   - Criar um projeto Vercel com uma rota reescrita que proxy para `https://fgbenetdksqnvwkgnips.supabase.co/functions/v1/*`.
   - Configurar `api.widezap.com.br` como domínio customizado no Vercel.
   - O Vercel funciona como reverse proxy: `api.widezap.com.br/v1/contacts` → `supabase.co/functions/v1/public-api/v1/contacts`.
   - Vantagem: controle total de caching, rate limit por IP (se necessário), e WAF.

3. **DNS**: criar registro CNAME `api` apontando para o destino escolhido (Supabase ou Vercel).

> Recomendação: **Supabase Custom Domains** é a opção mais simples (zero infra adicional). Se o plano não suportar, a opção Vercel é robusta e barata.

---

**Próximo passo:** Fase 1 — helper `_shared/public-api.ts` + edge function `public-api/index.ts`.