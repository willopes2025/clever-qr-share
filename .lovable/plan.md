

# Otimização: Atualizações otimistas no painel do lead (Inbox)

## Problema

Ao editar o nome do contato ou alterar a etapa do funil no painel lateral do Inbox, o sistema faz `invalidateQueries(['conversations'])`, que dispara um refetch completo de **todas as conversas + deals ativos**. Essa query é pesada (join de conversations + contacts + deals + tags) e causa um delay visível de alguns segundos.

O mesmo ocorre na troca de etapa via `LeadPanelFunnelBar`: o `updateDeal` já tem optimistic update para o cache `['funnels']` (usado no Kanban), mas **não** atualiza otimisticamente o cache `['conversations']` nem o `['contact-deal']`.

## Solução: Optimistic Updates locais

Aplicar atualizações otimistas nos caches do React Query para que a UI reflita a mudança instantaneamente, sem esperar o refetch.

### 1. `LeadPanelHeader.tsx` — Edição de nome do contato

- Antes do `await supabase.update()`, atualizar otimisticamente o cache `['conversations']` alterando o `contact.name` da conversa correspondente
- Se der erro, reverter ao snapshot anterior
- Manter o `invalidateQueries` no final para sincronizar dados reais (mas a UI já mostra o valor novo)

### 2. `LeadPanelNotes.tsx` — Edição de notas

- Mesmo padrão: atualizar `contact.notes` no cache `['conversations']` antes da chamada ao banco
- Reverter se falhar

### 3. `LeadPanelFunnelBar.tsx` — Troca de etapa do funil

- Ao trocar de etapa, além do optimistic update no cache `['funnels']` (que já existe), atualizar também o cache `['contact-deal', contactId]` para que o dropdown reflita a nova etapa imediatamente
- Atualizar o `deal` dentro do cache `['conversations']` para o `stage_name`, `stage_color` e `stage_id` ficarem corretos

### 4. `useFunnels.ts` — `updateDeal.onMutate`

- Estender o `onMutate` existente para também atualizar o cache `['contact-deal']` e `['conversations']` otimisticamente quando `stage_id` muda

## Arquivos a editar

| Arquivo | Mudança |
|---------|---------|
| `src/components/inbox/lead-panel/LeadPanelHeader.tsx` | Optimistic update do nome no cache `conversations` |
| `src/components/inbox/lead-panel/LeadPanelNotes.tsx` | Optimistic update das notas no cache `conversations` |
| `src/hooks/useFunnels.ts` | Estender `onMutate` do `updateDeal` para atualizar caches `contact-deal` e `conversations` |

Mudança de baixo risco — mantém o `invalidateQueries` para sincronização eventual, mas o usuário vê a mudança instantaneamente.

