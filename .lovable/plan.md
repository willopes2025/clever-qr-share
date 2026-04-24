## Diagnóstico — gargalo restante do Inbox

Depois das otimizações anteriores, o `useFunnels({ includeDeals: false })` ficou rápido. Mas o Inbox **ainda tem outro gargalo**, agora dentro do `useConversations`:

### O problema (`src/hooks/useConversations.ts`, linhas 179–208)

A cada carregamento da lista de conversas, o hook executa:

```ts
supabase
  .from('funnel_deals')
  .select('id, contact_id, stage_id, funnel_id, funnel:funnels(name), stage:funnel_stages(name, color)')
  .is('closed_at', null);   // ← SEM filtro de contato/usuário
```

Confirmei no banco: **9.171 deals abertos** em `funnel_deals`. Isso significa que, ao abrir o Inbox, o navegador baixa ~9 mil linhas com 2 joins, só para depois fazer o match em memória contra a lista de conversas (que normalmente tem ~50–200 itens visíveis).

**Pior ainda:** o `useGlobalRealtime` invalida `['conversations']` a cada:
- nova mensagem (`inbox_messages` INSERT)
- update em `conversations`
- update em `contacts`

Cada um desses eventos refaz o fetch das ~9k linhas. Em uma conversa ativa, isso ocorre várias vezes por minuto, deixando o sistema lento e congelado.

### Erros adicionais que pioram o quadro

1. `src/pages/Inbox.tsx` (linhas 68–87) cria **um segundo canal de realtime** (`conversations-updates`) duplicando o que `useGlobalRealtime` já faz — toda mudança em `conversations` dispara dois `refetch()` simultâneos.

2. O Supabase tem limite padrão de 1000 linhas por query, então é provável que esses 9k deals nem estejam vindo completos — pode haver leads ausentes do badge "etapa do funil" na lista de conversas.

---

## Plano de correção

### 1. Buscar apenas os deals dos contatos visíveis

Em `src/hooks/useConversations.ts`, trocar o `select(...).is('closed_at', null)` por uma versão filtrada pelos `contact_id`s das conversas que acabaram de ser carregadas:

```ts
const contactIds = (data || []).map(c => c.contact_id);
if (contactIds.length > 0) {
  const { data: deals } = await supabase
    .from('funnel_deals')
    .select('id, contact_id, stage_id, funnel_id, funnel:funnels(name), stage:funnel_stages(name, color)')
    .is('closed_at', null)
    .in('contact_id', contactIds);
  // build dealsMap...
}
```

Resultado: a query de deals passa de ~9.000 linhas para no máximo ~200 (uma por contato visível). Carga cai 95–98%.

### 2. Remover o canal de realtime duplicado em `Inbox.tsx`

`useGlobalRealtime` já cobre `conversations` + `inbox_messages`. O `useEffect` das linhas 68–87 do `src/pages/Inbox.tsx` é um duplo trabalho — vai sair.

### 3. Refinar invalidações em `useGlobalRealtime`

Hoje qualquer UPDATE em `contacts` (mudou avatar, nome, push name) invalida `['conversations']` inteiro. Vou manter a invalidação, mas com `refetchType: 'active'` para que apenas a query ativa do Inbox seja refeita (e não todas as variantes em cache).

### 4. Garantir que o badge de funil continua aparecendo

Como o `dealsMap` agora é construído após carregar conversations, o resultado para o usuário é idêntico — o painel da conversa e o badge do funil continuam vindo populados, só que sem baixar deals de contatos que nem estão na lista.

---

## Detalhes técnicos

**Arquivos a editar:**
- `src/hooks/useConversations.ts` — adicionar filtro `.in('contact_id', contactIds)` na query de deals
- `src/pages/Inbox.tsx` — remover o `useEffect` duplicado de realtime (linhas ~67–87)
- `src/hooks/useGlobalRealtime.ts` — adicionar `refetchType: 'active'` nas invalidações de `['conversations']` para evitar refetch de caches inativos

**Sem migração de banco** — os índices já existem (`idx_funnel_deals_contact_id`).

**Impacto esperado:**
- Tempo para abrir o Inbox: cai significativamente (uma query de ~200 linhas com índice é praticamente instantânea contra uma de ~9k linhas).
- Realtime: cada mensagem nova passa a refetchar somente a lista filtrada e ativa, em vez de rebaixar 9k deals.
- Resolve também o limite de 1000 linhas que pode estar omitindo leads do badge.

Posso aplicar?
