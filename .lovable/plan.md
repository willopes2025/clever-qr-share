## Objetivo

Quando o usuário digitar algo na busca do Inbox, separar a lista em duas seções visuais:

1. **Contatos** — conversas cujo match foi por nome / telefone / ID de contato.
2. **Conversas** — conversas cujo match foi pelo conteúdo das mensagens (com o snippet destacado que já existe).

Hoje todos os resultados aparecem misturados ordenados por horário. Sem busca ativa, o comportamento atual (ordenação por hora) é mantido.

## Mudanças

Arquivo único: `src/components/inbox/ConversationList.tsx`.

1. Logo após o `filteredConversations` (linha ~466), quando `debouncedSearch.trim().length >= 1` (busca ativa), particionar a lista em dois grupos:
   - `contactMatches`: conversas que batem por nome/telefone/displayId (mesma lógica de `matchesContactSearch` das linhas 320-333) **ou** cujo id está em `matchingContactConvIds` (server-side de contatos).
   - `messageMatches`: conversas que **não** entraram em `contactMatches` e cujo id está em `matchingConversationIds` (busca por conteúdo de mensagem).
   - Ambos mantêm a ordenação original (por `last_message_at` desc), garantindo que cada grupo siga a ordem de hora atual.

2. No bloco de render (linhas 547-748), quando a busca está ativa, renderizar dois subgrupos com cabeçalho discreto:
   ```text
   ─ Contatos (N) ─
     [card] [card] ...
   ─ Conversas (N) ─
     [card] [card] ...
   ```
   - Cabeçalho: `<div className="px-2 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">`.
   - Só renderiza a seção se tiver pelo menos 1 item.
   - Card de conversa permanece idêntico (mesmo JSX já existente, extraído para uma função `renderConversationCard(conversation)` interna para evitar duplicação).

3. Sem busca ativa: render permanece exatamente como hoje (um único grupo, sem cabeçalho).

## Fora de escopo

- Nenhuma mudança em `useConversationSearch`, `useContactSearch` ou no RPC `search_inbox_messages`.
- Nenhuma mudança no snippet com `<mark>` que já funciona.
- Nenhuma mudança em filtros, tabs (Todas/Não lidas/Arquivadas) ou ordenação dentro de cada grupo.
