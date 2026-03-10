

# Corrigir mensagens duplicadas no Inbox

## Problema

Existem **369 `whatsapp_message_id` duplicados** no banco de dados. A causa raiz é uma **condição de corrida**: quando dois webhooks chegam simultaneamente para a mesma mensagem, ambos passam na verificação de deduplicação (SELECT) antes de qualquer INSERT, resultando em duplicatas. Não existe um índice UNIQUE na coluna `whatsapp_message_id` para prevenir isso no nível do banco.

## Solução

### 1. Migração SQL: Limpar duplicatas existentes e criar índice UNIQUE

- Deletar registros duplicados, mantendo apenas o mais antigo (menor `created_at`) para cada `whatsapp_message_id`
- Criar um índice UNIQUE parcial em `whatsapp_message_id` (apenas WHERE NOT NULL), impedindo futuras duplicatas no nível do banco

```sql
-- Remove duplicates keeping the oldest
DELETE FROM inbox_messages 
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY whatsapp_message_id 
      ORDER BY created_at ASC
    ) as rn
    FROM inbox_messages
    WHERE whatsapp_message_id IS NOT NULL
  ) sub WHERE rn > 1
);

-- Prevent future duplicates
CREATE UNIQUE INDEX idx_inbox_messages_whatsapp_id_unique 
ON inbox_messages (whatsapp_message_id) 
WHERE whatsapp_message_id IS NOT NULL;
```

### 2. Edge Function `receive-webhook/index.ts`: Usar INSERT com ON CONFLICT

Alterar o INSERT de mensagens para usar upsert/on-conflict, de modo que mesmo que a verificação SELECT passe, o banco rejeita a duplicata silenciosamente. Adicionalmente, usar `INSERT ... ON CONFLICT DO NOTHING` via o método `.upsert()` com `ignoreDuplicates: true`, ou tratar o erro de unique constraint no catch.

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| Nova migração SQL | Limpa 369+ duplicatas e cria UNIQUE index |
| `supabase/functions/receive-webhook/index.ts` | Tratar erro de unique violation no INSERT para ignorar duplicatas silenciosamente |

