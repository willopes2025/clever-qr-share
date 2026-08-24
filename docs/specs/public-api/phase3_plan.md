# Plano de Implementação — Fase 3 (Webhooks de Saída com Assinatura HMAC)

> **Autor**: Arquiteto sênior WideZap · **Data**: 2026-08-20
> **Base**: `docs/specs/public-api/project_spec.md` §8 (item 3) + §9 (próximos passos)
> **Projeto de homologação**: `yxhjwpoaloqcnocpiyui.supabase.co`
> **Estilo**: mesmo molde das Fases 1 e 2 — decisões justificadas, alinhadas ao schema real.

---

## 0. Contexto e o que já existe

### O que a Fase 1 e 2 entregaram:
- **Public API**: CRUD contatos/leads com auth por API key + rate limit
- **Painel de API Keys**: UI para criar/renomear/revogar/deletar keys

### O que o spec diz:
- §8.3: *"Webhooks de saída (notificar cliente sobre eventos) — próxima feature natural"*
- §9: *"Webhooks de saída com assinatura HMAC"*

### O que já existe no codebase:
O projeto já tem uma **infraestrutura de webhook bidirecional** (Make/Zapier):

| Tabela | Função |
|--------|--------|
| `webhook_connections` | Conexões (nome, direção, URL destino, token) |
| `webhook_logs` | Logs de envio/recebimento |

**Mas falta (gap da Fase 3):**
1. **Assinatura HMAC** — não há `hmac_secret` na tabela nem signing no outbound
2. **Filtro de eventos** — não há coluna `events` para selecionar quais eventos enviar
3. **Mecanismo de dispatch** — não existe edge function que dispare webhooks quando eventos ocorrem
4. **Retry** — não há fila de tentativas para webhooks que falham
5. **Payload padronizado** — não há formato JSON definido para os webhooks de saída

---

## 1. Escopo da Fase 3

### 1.1 O que entra:
- Adicionar `hmac_secret` e `events` ao `webhook_connections`
- Criar tabela `webhook_deliveries` (fila + log de entregas)
- Criar edge function `dispatch-webhook` que:
  - Recebe um evento (tipo + payload)
  - Busca todas as connections ativas com aquele evento habilitado
  - Assina o payload com HMAC-SHA256
  - Envia HTTP POST para a URL destino
  - Registra resultado em `webhook_deliveries`
- Criar edge function `admin-webhook-config` (gerenciamento via UI)
- Atualizar a UI de webhooks para suportar:
  - Seleção de eventos ao criar/editar connection
  - Exibição/regeneração do HMAC secret
  - Teste de webhook (envio manual)
  - Visualização de deliveries (logs detalhados)

### 1.2 O que fica de fora:
- Webhooks de entrada (já existem via `make-webhook`, `receive-webhook`, etc.)
- Retry automático com fila (usaremos retry simples: 3 tentativas com backoff)
- Webhook de outras entidades (campanhas, inbox) — apenas contatos e leads nesta fase

---

## 2. Schema de dados

### 2.1 Extensão de `webhook_connections` (migration nova)

```sql
-- Adicionar colunas para HMAC e filtro de eventos
ALTER TABLE public.webhook_connections
  ADD COLUMN IF NOT EXISTS hmac_secret TEXT,           -- SHA-256 secret para assinatura
  ADD COLUMN IF NOT EXISTS events TEXT[] DEFAULT '{}', -- eventos habilitados
  ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ;   -- já existe, verificar

-- Gerar hmac_secret automaticamente para connections existentes
UPDATE public.webhook_connections
SET hmac_secret = encode(gen_random_bytes(32), 'hex')
WHERE hmac_secret IS NULL;
```

### 2.2 Tabela `webhook_deliveries` (migration nova)

```sql
CREATE TABLE public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.webhook_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,              -- ex: 'contact.created', 'lead.stage_changed'
  payload JSONB NOT NULL,               -- corpo enviado
  signature TEXT,                        -- HMAC-SHA256 (hex)
  status TEXT NOT NULL DEFAULT 'pending', -- pending | success | failed | retrying
  attempt INTEGER NOT NULL DEFAULT 1,   -- tentativa atual (1-3)
  max_attempts INTEGER NOT NULL DEFAULT 3,
  response_status INTEGER,              -- HTTP status da resposta
  response_body TEXT,                    -- corpo da resposta (truncado)
  error_message TEXT,                    -- erro se falhou
  next_retry_at TIMESTAMPTZ,            -- próxima tentativa agendada
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own deliveries"
  ON public.webhook_deliveries FOR SELECT
  TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own deliveries"
  ON public.webhook_deliveries FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());
```

### 2.3 Eventos suportados

```typescript
type WebhookEvent =
  | "contact.created"
  | "contact.updated"
  | "contact.deleted"
  | "lead.created"
  | "lead.updated"
  | "lead.stage_changed"
  | "lead.deleted";
```

---

## 3. Edge Functions

### 3.1 `dispatch-webhook/index.ts` (novo)

**Trigger**: chamado internamente por outras edge functions ou via SQL trigger.

**Fluxo:**
1. Recebe `{ event_type, payload, user_id }` via POST (service role)
2. Busca `webhook_connections` ativas com `events @> ARRAY[event_type]`
3. Para cada connection:
   a. Gera `signature = HMAC-SHA256(json(payload), hmac_secret)`
   b. Envia POST para `target_url` com headers:
      - `Content-Type: application/json`
      - `X-Webhook-Event: <event_type>`
      - `X-Webhook-Signature: sha256=<signature>`
      - `X-Webhook-Timestamp: <unix_timestamp>`
      - `X-Webhook-ID: <delivery_id>`
   c. Registra resultado em `webhook_deliveries`
   d. Se falhou e `attempt < max_attempts`, agenda retry com backoff exponencial

**Retry policy:**
- Tentativa 1: imediata
- Tentativa 2: +30 segundos
- Tentativa 3: +2 minutos
- Após 3 falhas: marca como `failed`

### 3.2 `admin-webhook-config/index.ts` (novo)

**Protegido por JWT** (padrão `admin-create-api-key`).

| Método | Ação | Body |
|--------|------|------|
| GET | Listar connections do usuário | — |
| POST | Criar connection | `{ name, target_url, events }` |
| PATCH | Atualizar connection | `{ id, name?, target_url?, events?, is_active? }` |
| DELETE | Deletar connection | `{ id }` |
| POST | Regenerar HMAC secret | `{ id }` |
| POST | Teste de webhook | `{ id }` → envia payload de teste |
| GET | Listar deliveries | `{ connection_id?, limit? }` |

### 3.3 Payload de teste (POST teste)

```json
{
  "event": "webhook.test",
  "timestamp": "2026-08-20T12:00:00Z",
  "data": {
    "message": "Este é um teste de webhook do WideZap"
  }
}
```

### 3.4 Payload de exemplo (contact.created)

```json
{
  "event": "contact.created",
  "timestamp": "2026-08-20T12:00:00Z",
  "data": {
    "id": "uuid",
    "phone": "11999998888",
    "name": "João Silva",
    "email": "joao@teste.com",
    "status": "active",
    "created_at": "2026-08-20T12:00:00Z"
  }
}
```

---

## 4. Frontend

### 4.1 Arquivos novos

```
src/hooks/useWebhookConfig.ts              # Hook: CRUD de webhook_connections + deliveries
src/components/webhooks/WebhookHmacDialog.tsx   # Dialog: exibir/regenerar HMAC secret
src/components/webhooks/WebhookTestDialog.tsx    # Dialog: teste de webhook
src/components/webhooks/WebhookEventSelector.tsx # Componente: multi-select de eventos
src/components/webhooks/WebhookDeliveryLog.tsx   # Componente: log de entregas detalhado
```

### 4.2 Atualizações

```
src/pages/Webhooks.tsx                           # Adicionar tab "Entregas" + campos de eventos
src/components/webhooks/WebhookConnectionCard.tsx # Adicionar badge de eventos + botão HMAC
src/components/webhooks/WebhookDocsPanel.tsx      # Atualizar docs com eventos de contatos/leads
```

### 4.3 Novos campos no dialog de criação

```
┌─────────────────────────────────────────┐
│ Criar Webhook                           │
├─────────────────────────────────────────┤
│ Nome: [_______________]                 │
│ URL de destino: [https://...]           │
│                                         │
│ Eventos:                                │
│ ☑ contato.criado                        │
│ ☑ contato.atualizado                    │
│ ☐ contato.deletado                      │
│ ☑ lead.criado                           │
│ ☑ lead.atualizado                       │
│ ☑ lead.mudanca_estagio                  │
│ ☐ lead.deletado                         │
│                                         │
│ [Criar]                                 │
└─────────────────────────────────────────┘
```

### 4.4 Botão de teste na card

```
┌─────────────────────────────────────────┐
│ Meu Webhook              [switch ativo] │
│ Badge: Ativo | Saída | 3 eventos       │
│                                         │
│ URL destino: https://hook.make.com/...  │
│ HMAC Secret: wz_wh_****... [Copiar]    │
│                                         │
│ Último envio: há 2h                     │
│                                         │
│ [Testar] [Renomear] [Excluir]           │
└─────────────────────────────────────────┘
```

---

## 5. Fluxo de dados completo

### 5.1 Criação de webhook

```
User → Webhooks → "Novo Webhook" → Preenche nome, URL, eventos
  → useWebhookConfig().create.mutate({ name, target_url, events })
    → admin-webhook-config POST
      → INSERT webhook_connections (hmac_secret gerado automaticamente)
        → Return { id, hmac_secret }
  → WebhookHmacDialog abre mostrando o hmac_secret (exibir 1x)
```

### 5.2 Envio de webhook (quando evento ocorre)

```
Edge Function (ex: public-api createContact)
  → after INSERT/UPDATE/DELETE on contacts
    → dispatch-webhook POST { event_type: "contact.created", payload, user_id }
      → SELECT webhook_connections WHERE user_id = X AND events @> ARRAY['contact.created'] AND is_active = true
      → Para cada connection:
        → HMAC-SHA256(payload, hmac_secret)
        → POST target_url com payload + headers de assinatura
        → INSERT webhook_deliveries (status, attempt, response)
        → Se falhou: schedule retry
```

### 5.3 Verificação da assinatura (lado do receptor)

```javascript
// O consumidor do webhook verifica:
const crypto = require('crypto');
const expected = crypto.createHmac('sha256', hmacSecret)
  .update(rawBody).digest('hex');
const received = req.headers['x-webhook-signature'].replace('sha256=', '');
if (expected !== received) {
  return res.status(401).send('Invalid signature');
}
```

---

## 6. Segurança

1. **HMAC secret**: gerado com `crypto.getRandomValues(32 bytes)`, armazenado como hex (64 chars)
2. **Secret exibido 1x**: ao criar, o UI mostra o secret. Depois, só prefixo. Regenerar = novo secret.
3. **Retry seguro**: retry não muda o payload — a assinatura é a mesma (replay seguro)
4. **Events whitelist**: só eventos listados na config são enviados (não envia tudo)
5. **Rate limit**: dispatch-webhook limita a 10 deliveries/segundo por connection (evita flood)
6. **Payload mínimo**: não envia dados sensíveis (senha, tokens) — só dados do contato/lead

---

## 7. Ordem de execução

1. **Migration**: adicionar colunas a `webhook_connections` + criar `webhook_deliveries`
2. **Backend**: `dispatch-webhook/index.ts` (assinatura + envio + retry)
3. **Backend**: `admin-webhook-config/index.ts` (CRUD + HMAC regenerar + teste)
4. **Deploy**: ambas as functions
5. **Frontend**: `useWebhookConfig.ts`
6. **Frontend**: `WebhookEventSelector.tsx`, `WebhookHmacDialog.tsx`, `WebhookTestDialog.tsx`
7. **Frontend**: atualizar `WebhookConnectionCard.tsx` (mostrar eventos + HMAC)
8. **Frontend**: atualizar `Webhooks.tsx` (tab entregas + campos de criação)
9. **Teste**: criar webhook → contact.created → verificar entrega + assinatura
10. **Lint/Build**

---

## 8. Riscos

- 🟢 **Schema**: extensão mínima de `webhook_connections` + tabela nova `webhook_deliveries`
- 🟢 **Backend**: padrão de edge function já estabelecido (admin-create-api-key)
- 🟡 **Dispatch**: integrar com o fluxo de criação de contatos/leads existente (public-api)
- 🟡 **UI**: a página de webhooks já existe — vamos estender, não recriar
- 🟡 **HMAC no browser**: o frontend não calcula HMAC — o backend gera e exibe
- 🔴 **Deno crypto**: `crypto.subtle` está disponível no Deno; `node:crypto` pode não estar
- 🔴 **Build**: manter sem aumentar contagem de erros ESLint `any`

---

**Próximo passo:** aprovar este plano e iniciar pela migration + dispatch-webhook.
