## Problema

A contato MARINEIA ROSA tem **2 negócios abertos** (closed_at = NULL) ao mesmo tempo:

1. `James & Jesse's` → Pré-venda (criado 20:12)
2. `Programa Seven` → Novo Lead (criado 20:46)

Cada parte da tela escolhe um deal diferente porque cada query usa uma lógica de seleção distinta:

| Local | Lógica atual | Resultado |
|---|---|---|
| `ConversationList.tsx` (lista da esquerda) | `dealsMap[contact_id] = deal` em loop → fica o **último** retornado pelo Supabase (sem ORDER BY) | mostra "James & Jesse's / Pré-venda" |
| `useConversations.ts` (mesma lista, fetch alternativo) | `if (!dealsMap[contact_id])` → fica o **primeiro** retornado | inconsistente |
| `useFunnels.useContactDeal` (painel direito / card) | `order created_at desc limit 1` → mais **recente** | mostra "Programa Seven / Novo Lead" |

Por isso a fila e o card divergem.

## Solução

Unificar a regra de "qual deal mostrar para um contato" em todos os pontos:

1. Se o contato tem um deal aberto vinculado à **conversa atual** (`funnel_deals.conversation_id = conversation.id`), usar esse.
2. Caso contrário, usar o deal aberto mais recentemente atualizado (`updated_at desc`, fallback `created_at desc`).

## Mudanças

### 1. `src/hooks/useFunnels.ts` — `useContactDeal`
- Aceitar `conversationId?: string` como segundo argumento.
- Buscar todos os deals abertos do contato (`funnel:funnels(...), stage:..., conversation_id, updated_at`).
- No client: priorizar o que `conversation_id === conversationId`; senão o de maior `updated_at`.

### 2. `src/components/inbox/lead-panel/LeadPanelFunnelBar.tsx`
- Repassar `conversationId` para `useContactDeal(contactId, conversationId)`.

### 3. `src/components/inbox/ConversationList.tsx` (fetch de deals da lista)
- Selecionar também `conversation_id, updated_at`.
- Ao montar `dealsMap`, agrupar por `contact_id` e escolher: deal cujo `conversation_id` bate com `conversation.id` da linha; senão o de maior `updated_at`.
- Como a relação é por contato (não por conversa) na construção atual, fazer o pick na hora de mapear conversas → deals (passo do `return conversationsData.map(...)`).

### 4. `src/hooks/useConversations.ts` (mesma fila, fetch paralelo)
- Mesma mudança: select inclui `conversation_id, updated_at`; na atribuição, preferir deal da conversa atual; fallback `updated_at` mais recente.

### 5. Invalidação de cache
- `useContactDeal` queryKey passa a ser `['contact-deal', contactId, conversationId]` para não vazar entre conversas.

## Não inclui

- Não vamos fechar/mesclar deals duplicados existentes (já existe o `MergeDealsDialog` para isso). Apenas garantir que a UI mostre o deal correto e consistente em todos os lugares.
