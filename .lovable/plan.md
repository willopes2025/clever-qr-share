# Plano: deixar o Inbox abrir mais rápido

## Diagnóstico

O hook `useConversations` (que alimenta a tela inteira) hoje faz a carga inicial em **4 etapas sequenciais**, todas indo até o banco:

```
STEP 1  →  conversations (lista crua, 200 linhas)   ~1ms no banco
STEP 2  →  contacts.in(contactIds)                  loop sequencial em chunks de 200
STEP 3  →  conversation_tag_assignments.in(...)     loop sequencial em chunks de 200
STEP 4  →  funnel_deals.in(contact_ids) + joins     loop sequencial em chunks de 200
```

Com 11.299 conversas e 12.585 deals em aberto, o `EXPLAIN ANALYZE` da query principal roda em **<1ms** — o gargalo não é o Postgres, são as 3 idas e voltas extras que rodam **em série** (cada round-trip do PostgREST custa 100–400 ms na Cloud). Resultado: a tela só pinta a lista quando todas terminam, então o tempo total acumula ~600–1500 ms só na primeira renderização, e cada invalidação por realtime repete o ciclo todo.

Outros pontos pequenos que somam:

- O `select` da STEP 2 puxa `custom_fields` e `notes` dos contatos. A lista do inbox não usa esses campos (são usados só no painel direito ao abrir a conversa).
- `hasInstanceRestriction` e `notification-instance-ids` ficam pendurados como pré-requisitos do `enabled` da query principal. Como duas chamadas separadas, somam mais uma rodada antes de a lista começar a carregar.
- `useGlobalRealtime` reinvalida `['conversations']` em *qualquer* mudança em `contacts`/`conversations`/`inbox_messages`, refazendo a carga completa de 4 passos toda vez que chega uma mensagem.

## O que vou mudar

### 1. Paralelizar STEP 2/3/4 em `src/hooks/useConversations.ts`

Trocar o `await` sequencial por um `Promise.all` único:

```ts
const [contactsMap, tagsMap, dealsMap] = await Promise.all([
  fetchContacts(contactIds),
  fetchTagAssignments(conversationIds),
  fetchOpenDeals(contactIds),
]);
```

Cada função interna mantém o loop de chunks (limite de 200 do PostgREST), mas as três rodam em paralelo. Ganho esperado: ~2 round-trips a menos por carga (≈ 400–800 ms na rede).

### 2. Enxugar o `select` de contatos da lista

Remover `custom_fields` e `notes` do select da STEP 2. O `RightSidePanel`/`ContactInfoPanel` já carrega o contato completo via hook próprio quando a conversa é aberta, então a lista do inbox não precisa carregar isso para todas as 200 linhas.

### 3. Disparar as queries de "gating" em paralelo com a principal

- Manter `hasInstanceRestriction` e `notification-instance-ids` como hooks separados.
- Mudar o `enabled` da query principal para iniciar assim que `user` estiver pronto, usando `undefined` como "sem filtro ainda" e refazendo quando os dados de restrição chegam. Hoje a query só começa depois que `hasInstanceRestriction` resolve — isso adiciona uma rodada bloqueante.

### 4. Reduzir invalidações em cascata do realtime

Em `src/hooks/useGlobalRealtime.ts`:

- Trocar a invalidação de `['conversations']` por uma atualização otimista no cache quando o payload do realtime já trouxer os campos necessários (`last_message_preview`, `last_message_at`, `unread_count`), caindo para `invalidateQueries` só quando o payload não bastar.
- Para `UPDATE` em `contacts`, invalidar somente quando o contato pertencer a alguma conversa atualmente em cache (em vez de refazer a lista inteira a cada edição de contato).

## Validação

1. Abrir a aba Network do preview, recarregar o Inbox e confirmar que as chamadas `contacts`, `conversation_tag_assignments` e `funnel_deals` agora saem em paralelo (mesmo `startedAt`), e que o tempo até "conversas pintadas" cai visivelmente.
2. Enviar/receber uma mensagem de teste e confirmar que o card sobe na lista sem o flash de "Carregando" (ou seja, sem refetch completo).
3. `EXPLAIN ANALYZE` da query principal continua usando `idx_conversations_pinned_last_msg` (sem regressão de plano).

## Fora de escopo

- Não vou mexer no layout, cores ou UX — só nas chamadas de dados.
- Não vou criar nova RPC consolidada agora (é uma opção futura se ainda estiver lento); o ganho da paralelização já costuma resolver casos como esse.
- Não vou alterar `useMessages` (carregamento da conversa aberta) nesta rodada — o relato é sobre "abrir a caixa", que é a lista.
