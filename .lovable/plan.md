## Objetivo
Eliminar o timeout que ainda impede o Inbox de abrir rapidamente.

## Diagnóstico
O problema continua no backend, não no layout. A requisição principal do Inbox ainda falha com `statement timeout` ao buscar `conversations`.

Evidências já confirmadas:
- A chamada que falha é `GET /rest/v1/conversations ... order=is_pinned.desc,last_message_at.desc&limit=300`.
- O erro retornado é `57014: canceling statement due to statement timeout`.
- A base está grande o suficiente para expor isso: cerca de `8.475 conversations`, `143.855 inbox_messages`, `19.898 contacts` e `9.176 funnel_deals` abertos.
- Hoje a tabela `conversations` só tem índices simples em `user_id`, `last_message_at`, `campaign_id`, `assigned_to`, `first_response_at` e `provider`. Não há índice cobrindo a ordenação/filtros usados pelo Inbox.
- A política atual de acesso do Inbox usa a função `can_access_conversation_channel(...)`, que é mais pesada do que a política anterior e pode agravar o custo da leitura em listas grandes.

## Plano
1. Ajustar a consulta principal do hook `useConversations` para reduzir custo antes do restante do pipeline.
   - Remover o `or(instance_id.is.null,instance_id.not.in(...))` quando não for necessário e substituir por uma estratégia mais indexável.
   - Separar o caso “instâncias notificacionais” para não degradar a query principal.
   - Reduzir a primeira carga para uma janela menor e previsível, com paginação incremental.

2. Corrigir o gargalo estrutural no banco via migration.
   - Criar índices compostos/parciais voltados ao Inbox, cobrindo ordenação e filtros reais (`user/org scope`, `status`, `is_pinned`, `last_message_at`, `instance_id`, `meta_phone_number_id` conforme aplicável).
   - Priorizar índices que ajudem tanto a query da lista quanto os cenários de filtros básicos (todas, não lidas, arquivadas).

3. Revisar a política/função de acesso usada por `conversations`.
   - Simplificar `can_access_conversation_channel(...)` ou trocar a policy para uma forma mais barata de execução em leitura massiva.
   - Preservar o comportamento de organização e restrições por instância/número, sem relaxar segurança.

4. Alinhar consultas auxiliares que ainda podem piorar a percepção de lentidão.
   - Tornar a busca de conversas faltantes em `ConversationList.tsx` compatível com o novo modelo leve, evitando `select *` com joins embutidos para IDs ausentes da busca.
   - Revisar `useUnreadCount` para garantir que não amplifique carga desnecessária em paralelo.

5. Validar o resultado após a correção.
   - Confirmar que a chamada principal do Inbox deixa de retornar 500/timeout.
   - Verificar abertura inicial, troca entre abas e busca sem regressão funcional.

## Detalhes técnicos
- Arquivos principais a alterar:
  - `src/hooks/useConversations.ts`
  - `src/components/inbox/ConversationList.tsx`
  - `src/hooks/useUnreadCount.ts`
  - nova migration em `supabase/migrations/`
- Mudanças esperadas no banco:
  - índices compostos/parciais para `conversations`
  - possível ajuste em função/policy relacionada a acesso organizacional do Inbox
- Segurança:
  - manter RLS e restrições por organização/instância/número
  - não relaxar acesso para “resolver performance”

## Resultado esperado
O Inbox volta a abrir sem timeout, com primeira carga rápida e sem depender de uma consulta cara demais para listar conversas.