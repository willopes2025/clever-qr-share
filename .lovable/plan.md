

# Correção: Filtro "Sem Resposta" no Inbox

## Problema Identificado

O filtro "Sem resposta" está mostrando conversas que já foram respondidas. Isso acontece porque a lógica atual verifica apenas o campo `first_response_at`, que não é confiável para determinar se a conversa precisa de resposta.

### Exemplo do Problema

| Conversa | first_response_at | Última Mensagem | Aparece no filtro? | Deveria aparecer? |
|----------|-------------------|-----------------|-------------------|-------------------|
| A | `null` | Outbound (atendente enviou) | ✅ Sim | ❌ Não |
| B | `null` | Inbound (cliente enviou) | ✅ Sim | ✅ Sim |
| C | Preenchido | Inbound (cliente enviou) | ❌ Não | ✅ Sim |

### Causa Raiz

O sistema não rastreia a **direção da última mensagem** na tabela `conversations`. Sem essa informação, é impossível saber se o cliente está aguardando resposta.

---

## Solução

Adicionar um novo campo `last_message_direction` à tabela `conversations` e usar esse campo para filtrar corretamente.

### Lógica Correta

Uma conversa aparece em "Sem resposta" quando:
- `last_message_direction = 'inbound'` (a última mensagem foi do cliente)

---

## Alterações Necessárias

### 1. Migração de Banco de Dados

Adicionar a coluna `last_message_direction` na tabela `conversations`:

```sql
ALTER TABLE conversations 
ADD COLUMN last_message_direction text;

-- Preencher dados existentes baseado na última mensagem
UPDATE conversations c
SET last_message_direction = (
  SELECT direction 
  FROM inbox_messages 
  WHERE conversation_id = c.id 
  ORDER BY created_at DESC 
  LIMIT 1
);
```

### 2. Atualizar Edge Functions

Todos os webhooks que atualizam `last_message_preview` devem também atualizar `last_message_direction`:

| Edge Function | Direção |
|---------------|---------|
| `receive-webhook` | `inbound` (mensagem recebida do cliente) |
| `meta-whatsapp-webhook` | `inbound` (mensagem recebida do cliente) |
| `send-inbox-message` | `outbound` (mensagem enviada) |
| `send-inbox-media` | `outbound` (mensagem enviada) |
| `meta-whatsapp-send` | `outbound` (mensagem enviada) |
| `ai-campaign-agent` | `outbound` (resposta da IA) |
| `process-funnel-automations` | `outbound` (automação) |
| `process-scheduled-task-messages` | `outbound` (agendamento) |

### 3. Atualizar Hook useConversations

Incluir o campo `last_message_direction` no select e interface:

```typescript
export interface Conversation {
  // ... campos existentes
  last_message_direction?: 'inbound' | 'outbound' | null;
}
```

### 4. Atualizar Lógica de Filtro

Modificar `ConversationList.tsx` para usar o novo campo:

```typescript
// Apply response status filter
if (filters.responseStatus !== 'all') {
  if (filters.responseStatus === 'no_response') {
    // Nova lógica: última mensagem deve ser inbound
    if (conv.last_message_direction !== 'inbound') return false;
  } else {
    // Filtros de tempo mantêm a mesma lógica
    // ...
  }
}
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| Migração SQL | Adicionar coluna `last_message_direction` |
| `supabase/functions/receive-webhook/index.ts` | Adicionar `last_message_direction: 'inbound'` |
| `supabase/functions/meta-whatsapp-webhook/index.ts` | Adicionar `last_message_direction: 'inbound'` |
| `supabase/functions/send-inbox-message/index.ts` | Adicionar `last_message_direction: 'outbound'` |
| `supabase/functions/send-inbox-media/index.ts` | Adicionar `last_message_direction: 'outbound'` |
| `supabase/functions/meta-whatsapp-send/index.ts` | Adicionar `last_message_direction: 'outbound'` |
| `supabase/functions/ai-campaign-agent/index.ts` | Adicionar `last_message_direction: 'outbound'` |
| `supabase/functions/process-funnel-automations/index.ts` | Adicionar `last_message_direction: 'outbound'` |
| `supabase/functions/process-scheduled-task-messages/index.ts` | Adicionar `last_message_direction: 'outbound'` |
| `src/hooks/useConversations.ts` | Adicionar tipo `last_message_direction` |
| `src/components/inbox/ConversationList.tsx` | Corrigir lógica do filtro |

---

## Resultado Esperado

Após a correção:
1. ✅ O filtro "Sem resposta" mostrará apenas conversas onde a última mensagem foi do cliente
2. ✅ Conversas já respondidas não aparecerão no filtro
3. ✅ Novas mensagens atualizarão automaticamente a direção
4. ✅ Os filtros de tempo (+15min, +1h, etc) continuarão funcionando corretamente

