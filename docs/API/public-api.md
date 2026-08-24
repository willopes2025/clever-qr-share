# WideZap Public API — Documentação

> **Versão**: v1 · **Base URL**: `https://<project-ref>.supabase.co/functions/v1/public-api/v1`
> **Autenticação**: API Key via header `Authorization: Bearer <api_key>`
> **Rate Limit**: 5 requisições por segundo por API Key

---

## Índice

1. [Autenticação](#1-autenticação)
2. [Rate Limit](#2-rate-limit)
3. [Formato de Resposta](#3-formato-de-resposta)
4. [Contatos — Endpoints](#4-contatos)
5. [Leads — Endpoints](#5-leads)
6. [Códigos de Erro](#6-códigos-de-erro)
7. [Exemplos Completos](#7-exemplos-completos)

---

## 1. Autenticação

Todas as requisições devem incluir o header:

```
Authorization: Bearer <sua_api_key>
```

**Formato da key**: `wz_live_` + 32 caracteres hexadecimais.

**Exemplo**:
```bash
curl -H "Authorization: Bearer wz_live_abc123..." \
  https://<ref>.supabase.co/functions/v1/public-api/v1/contacts
```

### Erros de autenticação

| Caso | HTTP | Código | Mensagem |
|---|---|---|---|
| Header ausente | 401 | `UNAUTHORIZED` | "API key ausente." |
| Key inválida | 401 | `UNAUTHORIZED` | "Credencial inválida." |
| Key revogada | 403 | `FORBIDDEN` | "API key revogada." |
| Key expirada | 403 | `FORBIDDEN` | "API key expirada." |

---

## 2. Rate Limit

- **Limite**: 5 requisições por segundo por API Key
- **Janela**: fixa de 1 segundo
- **Headers de resposta** (em toda resposta):

| Header | Descrição |
|---|---|
| `X-RateLimit-Limit` | Limite máximo (5) |
| `X-RateLimit-Remaining` | Requisições restantes na janela atual |
| `X-RateLimit-Reset` | Timestamp Unix do fim da janela |
| `Retry-After` | Segundos para aguardar (apenas em 429) |

---

## 3. Formato de Resposta

### Sucesso

```json
{
  "data": { ... },           // objeto (1 registro) ou array (listagem)
  "meta": {                  // presente em listagens/buscas
    "page": 1,
    "page_size": 50,
    "limit": 50,
    "total": 137,
    "has_more": true
  }
}
```

### Erro

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Mensagem legível.",
    "details": { "phone": "Campo obrigatório." }
  }
}
```

### Headers fixos

| Header | Valor |
|---|---|
| `Content-Type` | `application/json; charset=utf-8` |
| `Cache-Control` | `no-store` |
| `Access-Control-Allow-Origin` | `*` |

---

## 4. Contatos

Base: `https://<ref>.supabase.co/functions/v1/public-api/v1/contacts`

### POST `/v1/contacts` — Criar contato

**Body**:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `phone` | string | ✅ | Telefone (mínimo 10 dígitos, só números) |
| `name` | string | ❌ | Nome (máx 255 chars) |
| `email` | string | ❌ | E-mail válido |
| `notes` | string | ❌ | Observações |
| `status` | string | ❌ | `"active"` ou `"inactive"` (default: `"active"`) |
| `label_id` | UUID | ❌ | ID de etiqueta |
| `custom_fields` | array | ❌ | Campos customizados: `[{"custom_field_id": "id", "value": "valor"}]` |

**Resposta 201**:
```json
{
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "phone": "11999998888",
    "name": "João Silva",
    "email": "joao@email.com",
    "notes": null,
    "status": "active",
    "custom_fields": [{"custom_field_id": "field-1", "value": "teste"}],
    "label_id": null,
    "created_at": "2026-08-20T12:00:00Z",
    "updated_at": "2026-08-20T12:00:00Z"
  },
  "meta": {}
}
```

**Erros**:
- `400 VALIDATION_ERROR` — campos inválidos
- `409 DUPLICATE` — phone já existe na conta

---

### GET `/v1/contacts` — Listar contatos

**Query params**:

| Param | Tipo | Default | Descrição |
|---|---|---|---|
| `page` | int | 1 | Página |
| `page_size` | int | 50 | Itens por página (máx 100) |

**Resposta 200**:
```json
{
  "data": [ { ... }, { ... } ],
  "meta": { "page": 1, "page_size": 50, "total": 137, "has_more": true }
}
```

---

### GET `/v1/contacts/{id}` — Buscar por ID

Retorna exatamente 1 registro ou `404`.

**Resposta 200**:
```json
{ "data": { "id": "uuid", "phone": "...", ... } }
```

---

### GET `/v1/contacts?phone={phone}` — Buscar por telefone

Busca por contém (dígitos). Retorna lista limitada.

**Query params**: `phone` (string), `limit` (int, default 50, máx 100)

---

### GET `/v1/contacts?name={name}` — Buscar por nome

Busca case-insensitive com `ILIKE`. Retorna lista limitada.

**Query params**: `name` (string), `limit` (int, default 50, máx 100)

---

### PATCH `/v1/contacts/{id}` — Atualizar contato

Atualização parcial: só campos enviados são alterados.

**Body** (mesmos campos do POST, todos opcionais).

**Resposta 200**: contato atualizado.

---

### DELETE `/v1/contacts/{id}` — Deletar contato

Soft delete (`deleted_at`).

**Resposta 204**: sem corpo.

---

## 5. Leads

Base: `https://<ref>.supabase.co/functions/v1/public-api/v1/leads`

> **Lead = `funnel_deals`**. Todo lead está vinculado a um contato.

### POST `/v1/leads` — Criar lead

**Dois modos de criação**:

#### Modo A — Com contato existente

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `contact_id` | UUID | ✅ | ID do contato existente na conta |
| `title` | string | ❌ | Título do deal (default: nome do contato) |
| `value` | number | ❌ | Valor (>= 0, default: 0) |
| `currency` | string | ❌ | Moeda (default: "BRL") |
| `funnel_id` | UUID | ❌ | ID do funil (default: funil padrão do usuário) |
| `stage_id` | UUID | ❌ | ID do estágio (default: primeiro estágio do funil) |
| `expected_close_date` | string | ❌ | Data prevista (YYYY-MM-DD) |
| `source` | string | ❌ | Origem do lead |
| `notes` | string | ❌ | Observações |
| `custom_fields` | array | ❌ | `[{"custom_field_id": "id", "value": "valor"}]` |

#### Modo B — Com contato automático

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `phone` | string | ✅ | Telefone (mín 10 dígitos) |
| `name` | string | ✅ | Nome do contato |
| `email` | string | ❌ | E-mail do contato |
| `funnel_id` | UUID | ❌ | ID do funil |
| `stage_id` | UUID | ❌ | ID do estágio |
| (demais campos iguais ao Modo A) | | | |

**Resposta 201**:
```json
{
  "data": {
    "id": "uuid",
    "funnel_id": "uuid",
    "stage_id": "uuid",
    "contact_id": "uuid",
    "title": "Oportunidade",
    "value": 5000,
    "currency": "BRL",
    "custom_fields": [{"custom_field_id": "field-1", "value": "teste"}],
    "contact": { "id": "uuid", "phone": "...", "name": "..." },
    ...
  },
  "meta": {}
}
```

**Erros**:
- `400 VALIDATION_ERROR` — campos inválidos
- `422 UNRELATED_RESOURCE` — contact_id ou funnel_id não pertence à conta
- `422 FUNNEL_NOT_CONFIGURED` — sem funil padrão e sem funnel_id informado

---

### GET `/v1/leads` — Listar leads

**Query params**: `page`, `page_size`, `stage_id` (filtro por estágio)

---

### GET `/v1/leads/{id}` — Buscar lead por ID

Retorna o lead + contato vinculado em `data.contact`.

---

### GET `/v1/leads?phone={phone}` / `?name={name}` — Buscar leads

Busca no **contato vinculado**. Retorna lista limitada.

---

### PATCH `/v1/leads/{id}` — Atualizar lead

**Body**:

| Campo | Tipo | Descrição |
|---|---|---|
| `title` | string | Título |
| `value` | number | Valor |
| `currency` | string | Moeda |
| `funnel_id` | UUID | Mover para outro funil |
| `stage_id` | UUID | Mover para outro estágio |
| `expected_close_date` | string | Data prevista |
| `source` | string | Origem |
| `notes` | string | Observações |
| `custom_fields` | array | `[{"custom_field_id": "id", "value": "valor"}]` |

> Ao mudar `stage_id`, um registro é criado em `funnel_deal_history`.

---

### DELETE `/v1/leads/{id}` — Deletar lead

Soft delete. **204** em sucesso.

---

## 6. Códigos de Erro

| HTTP | Código | Significado |
|---|---|---|
| 200 | — | Sucesso |
| 201 | — | Criado |
| 204 | — | Deletado (sem corpo) |
| 400 | `VALIDATION_ERROR` | Campos inválidos |
| 401 | `UNAUTHORIZED` | Key ausente ou inválida |
| 403 | `FORBIDDEN` | Key revogada ou expirada |
| 404 | `NOT_FOUND` | Recurso não existe ou pertence a outra conta |
| 409 | `DUPLICATE` | Phone duplicado na mesma conta |
| 422 | `UNRELATED_RESOURCE` | Recurso não pertence à conta |
| 422 | `FUNNEL_NOT_CONFIGURED` | Sem funil padrão configurado |
| 429 | `RATE_LIMITED` | Limite de 5 req/s excedido |
| 500 | `INTERNAL_ERROR` | Erro interno |

---

## 7. Exemplos Completos

### Criar contato

```bash
curl -X POST "https://<ref>.supabase.co/functions/v1/public-api/v1/contacts" \
  -H "Authorization: Bearer wz_live_abc..." \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "11999998888",
    "name": "João Silva",
    "email": "joao@email.com",
    "custom_fields": [
      {"custom_field_id": "empresa", "value": "Acme Corp"},
      {"custom_field_id": "cargo", "value": "Diretor"}
    ]
  }'
```

### Criar lead com funil e estágio específicos

```bash
curl -X POST "https://<ref>.supabase.co/functions/v1/public-api/v1/leads" \
  -H "Authorization: Bearer wz_live_abc..." \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "11888887777",
    "name": "Maria Souza",
    "title": "Proposta Comercial",
    "value": 50000,
    "funnel_id": "uuid-do-funil",
    "stage_id": "uuid-do-estagio",
    "source": "site",
    "custom_fields": [
      {"custom_field_id": "origem_campanha", "value": "Google Ads"}
    ]
  }'
```

### Mover lead de estágio

```bash
curl -X PATCH "https://<ref>.supabase.co/functions/v1/public-api/v1/leads/<uuid>" \
  -H "Authorization: Bearer wz_live_abc..." \
  -H "Content-Type: application/json" \
  -d '{"stage_id": "uuid-novo-estagio"}'
```

### Listar leads filtrados por estágio

```bash
curl "https://<ref>.supabase.co/functions/v1/public-api/v1/leads?stage_id=<uuid>&page=1&page_size=20" \
  -H "Authorization: Bearer wz_live_abc..."
```

### Buscar contato por telefone

```bash
curl "https://<ref>.supabase.co/functions/v1/public-api/v1/contacts?phone=99999" \
  -H "Authorization: Bearer wz_live_abc..."
```

### Deletar contato (soft delete)

```bash
curl -X DELETE "https://<ref>.supabase.co/functions/v1/public-api/v1/contacts/<uuid>" \
  -H "Authorization: Bearer wz_live_abc..."
```
