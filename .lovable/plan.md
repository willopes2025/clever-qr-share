

## Correção: Sincronização de Cobranças Retornando Zero

### Problema

A função `sync-existing-billing-reminders` está usando URLs erradas da API do Asaas, causando erro 404 em todas as requisições de cobranças. Por isso, zero cobranças são encontradas e zero lembretes são criados.

URL atual (errada): `https://api.asaas.com/api/v3` (duplica o `/api`)
URL correta: `https://api.asaas.com/v3`

O mesmo erro existe na URL do sandbox.

### Correção

**Arquivo**: `supabase/functions/sync-existing-billing-reminders/index.ts`

Alterar as URLs na linha 117-119:

```typescript
// DE (errado):
const baseUrl = environment === 'sandbox'
  ? 'https://sandbox.asaas.com/api/v3'
  : 'https://api.asaas.com/api/v3';

// PARA (correto):
const baseUrl = environment === 'sandbox'
  ? 'https://api-sandbox.asaas.com/v3'
  : 'https://api.asaas.com/v3';
```

Isso alinha com o padrão já utilizado nas outras funções (`asaas-api`, `sync-asaas-contacts`, `start-campaign`).

### Resultado

Após o deploy, ao clicar em "Sincronizar cobranças existentes", a função vai conseguir buscar as cobranças PENDING e OVERDUE do Asaas e criar os lembretes correspondentes.

