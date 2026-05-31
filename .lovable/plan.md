## Objetivo

Quando o usuário digita um termo no campo de busca do Inbox (ex.: "urgente"), exibir, em cada conversa da lista, um trecho da mensagem que contém o termo — com a palavra destacada — em vez de apenas o `last_message_preview`. Comportamento similar ao WhatsApp Web.

## O que muda

### 1. `src/hooks/useConversationSearch.ts`
Hoje retorna apenas `string[]` (IDs de conversa). Passa a retornar também o trecho da mensagem que casou:

- Selecionar `conversation_id, content, created_at` (já seleciona `created_at`, falta `content`).
- Para cada `conversation_id` único, guardar a **primeira ocorrência** (mensagem mais recente) e expor:
  - `ids: string[]` (mantém compatibilidade com `useContactSearch` e `missingConversationIds`)
  - `snippets: Record<conversationId, { content: string; created_at: string }>`
- Manter o teto `MAX_IDS = 800` e o limite de 2000 linhas.

### 2. `src/components/inbox/ConversationList.tsx`
- Consumir o novo `snippets` do hook.
- Criar um helper `buildSnippet(content, term)` que:
  - Localiza o termo (case/diacríticos-insensitive, reaproveitando `normalizeText`).
  - Recorta uma janela curta ao redor (~40 chars antes / ~60 depois) com `…` quando truncado.
  - Retorna `{ before, match, after }` para renderização.
- No bloco da pré-visualização (linhas ~688–696), quando:
  - `debouncedSearch.length >= 3` **e** existe `snippets[conversation.id]`
  → renderizar o snippet, com a parte `match` envolvida em `<mark className="bg-primary/20 text-foreground rounded px-0.5">`.
  - Caso contrário, manter `last_message_preview` como hoje.
- Manter `truncate` e a mesma tipografia (negrito se `unread_count > 0`).

### 3. Sem mudanças de backend
A busca continua usando `inbox_messages.content` via PostgREST ILIKE. Nenhuma migration, nenhuma edge function alterada.

## Fora de escopo
- Busca em mídia/legendas separadas, paginação de múltiplos hits por conversa, ou navegação até a mensagem dentro da conversa (pode ser um próximo passo).
- Mudanças no `useContactSearch` (matches por nome/telefone seguem mostrando `last_message_preview`).
