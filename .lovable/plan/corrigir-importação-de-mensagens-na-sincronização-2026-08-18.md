# Corrigir importação de mensagens na sincronização

## Diagnóstico (confirmado)

Os logs da função mostram, repetidamente:

`[SYNC] upsert error: there is no unique or exclusion constraint matching the ON CONFLICT specification`

Causa: a sincronização grava mensagens com `upsert(..., onConflict: 'whatsapp_message_id')`, mas o índice único da tabela de mensagens é **parcial** (`... WHERE whatsapp_message_id IS NOT NULL`). A API de dados não aceita índices parciais em ON CONFLICT, então **todo lote de mensagens falha** — daí "0 mensagens importadas" e as 125 conversas com erro. Contatos continuam sendo criados porque usam outro caminho.

## Correção

1. Substituir o `upsert` por uma gravação em duas etapas no lote:
   - consultar quais `whatsapp_message_id` do lote já existem;
   - inserir apenas os que faltam (`insert`), contando as linhas realmente inseridas.
   Isso mantém a deduplicação sem depender do ON CONFLICT, e o índice parcial continua protegendo contra duplicatas em corridas.
2. Tratar erro de duplicidade (código 23505) como "já existe" em vez de contar como falha da conversa.
3. Contar erro por conversa apenas uma vez, não por chunk, para o painel de progresso refletir a realidade.

## Verificação

- Reprocessar o job atual e conferir nos logs que não há mais o erro de ON CONFLICT e que `+N msgs` passa a ser maior que zero.
- Conferir no Inbox que as conversas sincronizadas mostram histórico.

## Detalhes técnicos

Arquivo: `supabase/functions/sync-message-history/index.ts` (bloco de gravação de mensagens, linhas ~310-333). Sem alteração de schema — o índice parcial `idx_inbox_messages_whatsapp_id_unique` permanece como está.
