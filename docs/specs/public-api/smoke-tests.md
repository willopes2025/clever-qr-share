# Smoke Tests — Public API (Fase 1)

> Requer: URL do projeto Supabase + uma API key emitida via `admin-create-api-key`.
> Base URL: `https://<project-ref>.supabase.co/functions/v1`

## Setup

### 1. Emitir uma API key (protegido por JWT)

```bash
curl -X POST \
  "https://<ref>.supabase.co/functions/v1/admin-create-api-key" \
  -H "Authorization: Bearer <SUPABASE_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"name": "smoke-test"}'
```

Salvar a `key` retornada. Usar em todos os testes abaixo como `Authorization: Bearer <key>`.

---

## Autenticação

### 2. Sem header → 401

```bash
curl -s "https://<ref>.supabase.co/functions/v1/public-api/v1/contacts"
```

Esperado: `401` com `"code": "UNAUTHORIZED"`.

### 3. Key inválida → 401 genérico

```bash
curl -s \
  -H "Authorization: Bearer wz_live_00000000000000000000000000000000" \
  "https://<ref>.supabase.co/functions/v1/public-api/v1/contacts"
```

Esperado: `401` com `"message": "Credencial inválida."`.

---

## Contatos — CRUD

### 4. Criar contato → 201

```bash
curl -X POST \
  "https://<ref>.supabase.co/functions/v1/public-api/v1/contacts" \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"phone": "11999998888", "name": "João Silva", "email": "joao@test.com"}'
```

Esperado: `201` com `data.id` (UUID) e `data.phone = "11999998888"`.

### 5. Duplicar phone → 409

```bash
# Repetir o mesmo comando do teste 4
```

Esperado: `409` com `"code": "DUPLICATE"`.

### 6. Listar contatos → 200

```bash
curl -s \
  -H "Authorization: Bearer <API_KEY>" \
  "https://<ref>.supabase.co/functions/v1/public-api/v1/contacts"
```

Esperado: `200` com `data` (array) e `meta.page`, `meta.total`.

### 7. Buscar por ID → 200

```bash
curl -s \
  -H "Authorization: Bearer <API_KEY>" \
  "https://<ref>.supabase.co/functions/v1/public-api/v1/contacts/<UUID>"
```

Esperado: `200` com `data.id = UUID`.

### 8. Buscar por ID inexistente → 404

```bash
curl -s \
  -H "Authorization: Bearer <API_KEY>" \
  "https://<ref>.supabase.co/functions/v1/public-api/v1/contacts/00000000-0000-0000-0000-000000000000"
```

Esperado: `404`.

### 9. Buscar por phone → 200 com lista

```bash
curl -s \
  -H "Authorization: Bearer <API_KEY>" \
  "https://<ref>.supabase.co/functions/v1/public-api/v1/contacts?phone=99999"
```

Esperado: `200` com `data` contendo registros que contêm "99999" no phone.

### 10. Buscar por name → 200

```bash
curl -s \
  -H "Authorization: Bearer <API_KEY>" \
  "https://<ref>.supabase.co/functions/v1/public-api/v1/contacts?name=João"
```

Esperado: `200` com `data` contendo "João".

### 11. Atualizar contato → 200

```bash
curl -X PATCH \
  "https://<ref>.supabase.co/functions/v1/public-api/v1/contacts/<UUID>" \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"name": "João Santos", "notes": "atualizado"}'
```

Esperado: `200` com `data.name = "João Santos"` e `data.notes = "atualizado"`.

### 12. Deletar contato → 204

```bash
curl -X DELETE \
  -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer <API_KEY>" \
  "https://<ref>.supabase.co/functions/v1/public-api/v1/contacts/<UUID>"
```

Esperado: `204`.

### 13. Buscar deletado → 404

Repetir teste 7 após deletar. Esperado: `404`.

---

## Leads — CRUD

### 14. Criar lead com phone+name (sem contact_id) → 201

```bash
curl -X POST \
  "https://<ref>.supabase.co/functions/v1/public-api/v1/leads" \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"phone": "11888887777", "name": "Maria Souza", "title": "Lead Teste", "value": 5000}'
```

Esperado: `201` com `data.contact` (contato criado automaticamente) e `data.funnel_id` (funil padrão).

### 15. Criar lead com contact_id existente → 201

```bash
curl -X POST \
  "https://<ref>.supabase.co/functions/v1/public-api/v1/leads" \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"contact_id": "<UUID>", "title": "Lead Existente"}'
```

Esperado: `201`.

### 16. Criar lead com contact_id de outra conta → 422

```bash
curl -X POST \
  "https://<ref>.supabase.co/functions/v1/public-api/v1/leads" \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"contact_id": "00000000-0000-0000-0000-000000000000", "title": "Teste"}'
```

Esperado: `422` com `"code": "UNRELATED_RESOURCE"`.

### 17. Criar lead sem phone+name e sem contact_id → 400

```bash
curl -X POST \
  "https://<ref>.supabase.co/functions/v1/public-api/v1/leads" \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Sem dados"}'
```

Esperado: `400` com `"code": "VALIDATION_ERROR"`.

### 18. Listar leads → 200

```bash
curl -s \
  -H "Authorization: Bearer <API_KEY>" \
  "https://<ref>.supabase.co/functions/v1/public-api/v1/leads"
```

Esperado: `200` com `data` e `meta`.

### 19. Buscar lead por ID → 200

```bash
curl -s \
  -H "Authorization: Bearer <API_KEY>" \
  "https://<ref>.supabase.co/functions/v1/public-api/v1/leads/<UUID>"
```

Esperado: `200` com `data.contact`.

### 20. Mover lead de estágio → 200 + histórico

```bash
curl -X PATCH \
  "https://<ref>.supabase.co/functions/v1/public-api/v1/leads/<UUID>" \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"stage_id": "<NOVO_STAGE_UUID>"}'
```

Esperado: `200`. Verificar na tabela `funnel_deal_history` que foi inserido um registro.

### 21. Deletar lead → 204

```bash
curl -X DELETE \
  -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer <API_KEY>" \
  "https://<ref>.supabase.co/functions/v1/public-api/v1/leads/<UUID>"
```

Esperado: `204`.

---

## Multitenant

### 22. Key da conta A não enxerga dados da conta B

Com a key da conta A, buscar ID de um contato/lead que pertence à conta B.

```bash
curl -s \
  -H "Authorization: Bearer <KEY_CONTA_A>" \
  "https://<ref>.supabase.co/functions/v1/public-api/v1/contacts/<UUID_CONTA_B>"
```

Esperado: `404` (não revela existência).

---

## Rate Limit

### 23. 6 chamadas no mesmo segundo → 429 na 6ª

```bash
for i in $(seq 1 6); do
  echo "=== Requisição $i ==="
  curl -s -w "\nHTTP %{http_code}\n" \
    -H "Authorization: Bearer <API_KEY>" \
    "https://<ref>.supabase.co/functions/v1/public-api/v1/contacts"
done
```

Esperado: 5 primeiras retornam `200`, a 6ª retorna `429` com `Retry-After: 1` e `X-RateLimit-*`.

---

## Revogação de Key

### 24. Revogar key → 200

```bash
curl -X PATCH \
  "https://<ref>.supabase.co/functions/v1/admin-create-api-key" \
  -H "Authorization: Bearer <SUPABASE_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"key_id": "<KEY_ID>"}'
```

Esperado: `200` com `success: true`.

### 25. Key revogada → 403

```bash
curl -s \
  -H "Authorization: Bearer <KEY_REVOGADA>" \
  "https://<ref>.supabase.co/functions/v1/public-api/v1/contacts"
```

Esperado: `403` com `"code": "FORBIDDEN"` e `"message": "API key revogada."`.

---

## Phone — Validação

### 26. Phone com menos de 10 dígitos → 400

```bash
curl -X POST \
  "https://<ref>.supabase.co/functions/v1/public-api/v1/contacts" \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"phone": "1234567", "name": "Teste"}'
```

Esperado: `400` com `"code": "VALIDATION_ERROR"` e `details.phone` contendo mensagem.

---

## Checklist de Validação

| # | Cenário | Esperado | Status |
|---|---------|----------|--------|
| 2 | Sem auth | 401 | ☐ |
| 3 | Key inválida | 401 | ☐ |
| 4 | Criar contato | 201 | ☐ |
| 5 | Duplicar phone | 409 | ☐ |
| 6 | Listar | 200 | ☐ |
| 7 | Buscar ID | 200 | ☐ |
| 8 | ID inexistente | 404 | ☐ |
| 9 | Buscar phone | 200 | ☐ |
| 10 | Buscar name | 200 | ☐ |
| 11 | Atualizar | 200 | ☐ |
| 12 | Deletar | 204 | ☐ |
| 13 | Buscar deletado | 404 | ☐ |
| 14 | Lead automático | 201 | ☐ |
| 15 | Lead existente | 201 | ☐ |
| 16 | Lead cross-tenant | 422 | ☐ |
| 17 | Lead sem dados | 400 | ☐ |
| 18 | Listar leads | 200 | ☐ |
| 19 | Buscar lead ID | 200 | ☐ |
| 20 | Mover estágio | 200 | ☐ |
| 21 | Deletar lead | 204 | ☐ |
| 22 | Multitenant | 404 | ☐ |
| 23 | Rate limit | 429 | ☐ |
| 24 | Revogar key | 200 | ☐ |
| 25 | Key revogada | 403 | ☐ |
| 26 | Phone inválido | 400 | ☐ |
