## Diagnóstico

O número que aparece ao lado do **Inbox** na sidebar e no **título da aba do Chrome** (`(N) Wide…`) vem de `useUnreadCount` (`src/hooks/useUnreadCount.ts`). Hoje esse hook faz:

```ts
supabase.from('conversations')
  .select('unread_count')
  .gt('unread_count', 0)
  .neq('status', 'archived');
// retorna SUM(unread_count)
```

Isso não bate com o número real visto no Inbox por **5 motivos**:

1. **Não exclui instâncias `is_notification_only`** — conversas dessas instâncias contam aqui, mas são ocultadas no Inbox (`useConversations` filtra `notificationInstanceIds`).
2. **Não exclui instâncias ocultadas pelo usuário** (`useInboxHiddenInstances` / `hiddenInstanceIds`) — também ocultas no Inbox, mas contadas no badge.
3. **Não exclui conversas do ecossistema de aquecimento** (`warming_contacts` / `warming_pool` — `warmingPhones`) — poluem o badge.
4. **Não exclui conversas "fantasmas"** (sem `last_message_preview`, sem `last_message_direction` e sem nome de contato) — o Inbox filtra, o badge não.
5. **Métrica diferente**: o badge soma `unread_count` (ex.: 1 conversa com 7 mensagens não lidas = 7), enquanto o Inbox/aba "Não lidas" mostra **número de conversas** com `unread_count > 0` (`ConversationList.tsx` linha 446: `conversations.filter(c => c.unread_count > 0 && c.status !== "archived").length`).

Resultado típico: badge mostra um número bem maior que o do Inbox, e que muda sozinho conforme novas mensagens entram em conversas escondidas/aquecimento.

## Correção proposta

Reescrever `src/hooks/useUnreadCount.ts` para usar exatamente os mesmos filtros do `useConversations` e a mesma métrica do Inbox (contagem de conversas, não soma).

Passos:

1. Buscar em paralelo (cacheáveis e já existentes em outros hooks):
   - IDs de instâncias `is_notification_only` (reaproveitar a mesma queryKey `['notification-instance-ids', user?.id]`).
   - `hiddenInstanceIds` via `useInboxHiddenInstances`.
   - `allowedInstanceIds` + `hasInstanceRestriction` quando o membro tem restrição.
   - Conjunto `warmingPhones` (phones de `warming_contacts` + `warming_pool`).
2. Consultar `conversations` selecionando apenas o necessário para filtrar e contar:
   `id, instance_id, contact_id, unread_count, status, last_message_preview, last_message_direction`, com `gt('unread_count', 0)` e `neq('status', 'archived')`, aplicando o mesmo filtro de `instance_id` (incluindo `instance_id IS NULL`) usado em `useConversations`.
3. Buscar `contacts(id, name, phone)` em chunks só para os `contact_id` retornados (mesmo padrão da listagem).
4. Aplicar client-side os mesmos filtros do Inbox:
   - remover `instance_id` em `notificationInstanceIds`;
   - remover `instance_id` em `hiddenInstanceIds`;
   - remover "fantasmas" (sem preview/direction/nome);
   - remover phones presentes em `warmingPhones`.
5. Retornar **`filtered.length`** (número de conversas não lidas), e não a soma de `unread_count`. Isso fica idêntico ao número do badge "Não lidas" da aba do Inbox e ao indicador na sidebar.
6. Manter `staleTime: 30_000` e a invalidação já existente em `useGlobalRealtime` (`['unread-count']`).
7. `useUnreadBadge` continua igual — ele só formata `(${n})` no `document.title`, então passa a refletir o novo valor automaticamente.

## Validação

- Abrir Inbox e comparar: número exibido na aba "Não lidas" do `ConversationList` deve ser igual ao badge da sidebar e ao `(N)` no título da aba do Chrome.
- Ocultar uma instância em "Ocultar do inbox": badge deve cair junto com a lista.
- Marcar uma conversa do aquecimento como não lida no banco: não deve afetar o badge.
- Marcar `is_notification_only` em uma instância: conversas dela não devem mais contar no badge.

## Arquivos afetados

- `src/hooks/useUnreadCount.ts` (reescrita)
- Nenhuma mudança de schema, RLS, edge function ou UI.
