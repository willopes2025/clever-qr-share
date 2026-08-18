# Corrigir erro na sincronização de mensagens (timeout da função)

## O que está acontecendo

A sincronização faz tudo dentro de uma única chamada: lista todas as conversas da instância
(até 2.000) e, para cada uma, chama a Evolution API e grava contato, conversa e mensagens
uma a uma, em sequência.

Nos registros da última execução, cada conversa leva cerca de 0,2 a 4 segundos. Com centenas
de conversas, a chamada ultrapassa o tempo máximo permitido para uma função e é encerrada no
meio — é aí que aparece o erro "non-2xx". Ou seja, não é falha da Evolution: é a rotina longa
demais para uma única requisição. Parte das mensagens chega a ser gravada antes de morrer,
o que explica sincronizações "pela metade".

## Como será corrigido

1. **Sincronização em segundo plano com job**
   - Criar uma tabela de trabalhos de sincronização (instância, data inicial, status,
     total de conversas, quantas já processadas, mensagens/contatos importados, erro).
   - A função passa a criar o job, responder imediatamente e continuar o trabalho em segundo plano.
   - O processamento acontece em lotes: cada lote pega um bloco de conversas, grava o progresso
     e re-agenda o próximo lote, sem nunca estourar o tempo de uma execução.

2. **Processamento mais rápido por conversa**
   - Buscar contatos/conversas existentes em bloco em vez de uma consulta por chat.
   - Inserir mensagens em lote com "upsert" pelo id do WhatsApp, eliminando a consulta
     de existência mensagem a mensagem (hoje é uma ida ao banco por mensagem).

3. **Interface com progresso real**
   - O botão de sincronizar passa a iniciar o job e acompanhar o andamento
     ("X de Y conversas, N mensagens importadas"), com estado final de concluído ou falhou
     e mensagem de erro legível em português.
   - Impedir iniciar duas sincronizações simultâneas para a mesma instância.

## Detalhes técnicos

- Nova tabela `message_sync_jobs` (com RLS por organização e GRANTs), populada e atualizada
  pela função via service role.
- `supabase/functions/sync-message-history/index.ts`: divide em `start` (cria job, responde 202)
  e `processBatch` executado via `EdgeRuntime.waitUntil`, com cursor por índice de chat e
  lotes de ~40 conversas; mantém os fallbacks atuais (findChats → findContacts → contatos do banco).
- Substituir o `select` por mensagem por `upsert ... onConflict: whatsapp_message_id`
  (exige índice único em `inbox_messages.whatsapp_message_id`, que será verificado/criado).
- `src/hooks/useSyncHistory.ts`: passa a criar o job e fazer polling do status;
  o componente que exibe o progresso usa os números reais do job.
