

# Correção do Registro de Webhook Asaas

## Problema
A API do Asaas está retornando erro dizendo que `name`, `sendType` e `events` estão ausentes, mesmo estando no payload. Isso indica que a API não está recebendo/parseando o corpo JSON corretamente.

## Causa Raiz
O endpoint de webhook do Asaas (`POST /v3/webhooks`) pode estar rejeitando o payload por campos extras como `apiVersion`, `authToken`, `interrupted` que não fazem parte dos parâmetros aceitos na criação/atualização. Esses campos extras podem estar causando a rejeição silenciosa dos campos válidos.

## Plano

### 1. Corrigir o payload do webhook na Edge Function `register-asaas-webhook`
- Remover campos desnecessários: `apiVersion`, `authToken`, `interrupted`
- Manter apenas os campos documentados pela API do Asaas: `name`, `url`, `email`, `enabled`, `sendType`, `events`
- Adicionar log do response body para debug caso ocorra erro novamente

### Arquivo Modificado
- `supabase/functions/register-asaas-webhook/index.ts` - Limpar payload e melhorar tratamento de erros

### Mudança Principal
```typescript
// ANTES (campos extras causando rejeição)
const webhookPayload = {
  name: 'Lovable CRM Webhook',
  url: webhookUrl,
  email: user.email || '',
  enabled: true,
  interrupted: false,      // ← campo extra
  apiVersion: 3,           // ← campo extra
  authToken: '',           // ← campo extra
  sendType: 'SEQUENTIALLY',
  events: [...]
};

// DEPOIS (apenas campos aceitos pela API)
const webhookPayload = {
  name: 'Lovable CRM Webhook',
  url: webhookUrl,
  email: user.email || '',
  enabled: true,
  sendType: 'SEQUENTIALLY',
  events: [
    'PAYMENT_CREATED', 'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED',
    'PAYMENT_RECEIVED_IN_CASH', 'PAYMENT_OVERDUE',
    'PAYMENT_DELETED', 'PAYMENT_REFUNDED', 'PAYMENT_UPDATED'
  ]
};
```

