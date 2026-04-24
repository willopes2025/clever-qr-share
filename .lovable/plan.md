## Diagnóstico — por que o funil no Inbox está lento

Ao abrir uma conversa no Inbox, o painel lateral (`RightSidePanel`) carrega o `useFunnels()`, que executa um padrão **N+1 muito pesado**:

### O que acontece hoje (`src/hooks/useFunnels.ts`, linhas 100–153)

```text
1 query  → busca todos os funis + stages
+ N queries → para CADA stage, faz uma query separada buscando até 50 deals
              (com JOIN em contacts e funnel_close_reasons)
```

Para um usuário com muitos funis, isso significa **dezenas a centenas de requests sequenciais ao Postgres** só para abrir uma conversa. Exemplos reais no banco:

- 1 usuário com 49 stages → **50 queries** por carregamento
- 1 usuário com 22 stages → **23 queries** por carregamento
- Total no banco: 9.238 deals, 126 stages, 18 funis

E o pior: **o Inbox não precisa da lista de deals por stage** — só usa `funnels[].stages[]` para popular o dropdown de etapas no `LeadPanelFunnelBar`. Os deals só são consumidos pela página do Funil (`/funnels`).

Além disso:
- `useGlobalRealtime` invalida `['funnels']` em **qualquer** mudança em `funnel_deals` (toda mensagem nova que move um lead refaz todas as N+1 queries)
- A tela do Inbox monta o `useFunnels` em vários componentes (LeadPanelFunnelBar, RightSidePanel) — cada um dispara o pipeline pesado

### Erro adicional observado nos logs

```text
GET /internal_chat_group_members → 500
"infinite recursion detected in policy for relation internal_chat_group_members"
```

Não causa a lentidão do funil, mas é um bug de RLS que está retornando 500 a cada navegação. Vou corrigir no mesmo passe.

---

## Plano de correção

### 1. Tornar a query `['funnels']` leve por padrão

Alterar `useFunnels` em `src/hooks/useFunnels.ts` para **não** carregar deals por stage no fetch base. A query passa a retornar apenas funis + stages (1 única query, sem N+1). Os locais que precisam dos deals já usam hooks dedicados:

- Página do Funil → `useStageDealCounts` + `useLoadMoreDeals` (já existem em `useFunnelDeals.ts`)
- Inbox → só precisa de `stages[]` para o dropdown

Resultado: abrir uma conversa passa de ~50 queries para 1.

### 2. Ajustar a página do Funil para carregar deals sob demanda

Verificar `src/pages/Funnels.tsx` e componentes de Kanban. Onde ainda dependerem de `funnel.stages[].deals` no payload inicial, trocar por `useLoadMoreDeals` (paginação que já existe). Manter a mesma UX — apenas garantindo que os deals da primeira página sejam carregados ao abrir a tela do funil, não ao abrir o Inbox.

### 3. Refinar a invalidação do realtime

Em `src/hooks/useGlobalRealtime.ts`, parar de invalidar `['funnels']` em mudanças de `funnel_deals`. Manter apenas:
- `['contact-deal']` (painel do Inbox)
- `['funnel-deals']` e `['stage-deal-counts']` (Kanban)

`['funnels']` só precisa invalidar quando muda funil/stage em si.

### 4. Corrigir recursão de RLS em `internal_chat_group_members`

Criar migration que substitui a policy recursiva por uma versão usando função `SECURITY DEFINER` (padrão já adotado no projeto com `has_role`, `get_organization_member_ids`, etc.).

---

## Detalhes técnicos

**Arquivos editados:**
- `src/hooks/useFunnels.ts` — remover o `Promise.all` de deals por stage da query principal
- `src/pages/Funnels.tsx` e componentes de Kanban dentro de `src/components/funnels/` — garantir uso de `useStageDealCounts` + `useLoadMoreDeals`
- `src/hooks/useGlobalRealtime.ts` — afinar invalidações
- Migration SQL — nova policy não-recursiva para `internal_chat_group_members` usando função SECURITY DEFINER

**Tipo `Funnel.stages[].deals`** continua opcional (`deals?: FunnelDeal[]`) — código consumidor não quebra; apenas vem `undefined` no Inbox.

**Impacto esperado:** abertura de conversa no Inbox deve cair de vários segundos para ~100–300 ms na parte do funil.
