

## Plano: Corrigir contagem de contatos em listas dinâmicas

### Problema identificado

A lista "Disparos WIll" foi criada corretamente com a tag "igrejass" (99 contatos com essa tag existem no banco). Porém, **o card da lista mostra "0 contatos"** porque o sistema define `contact_count = 0` para todas as listas dinâmicas na listagem inicial (lazy loading).

Quando o usuário abre a lista para visualizar, os contatos devem aparecer normalmente. Mas o "0" no card dá a impressão de que a lista está vazia.

### Solução

1. **Calcular a contagem real para listas dinâmicas** — Ao carregar as listas, executar a mesma query de contatos para listas dinâmicas (com tags/filtros), mas usando `count: 'exact', head: true` para obter apenas a contagem sem carregar todos os dados
2. **Cache da contagem** — Armazenar a contagem no state para evitar recalcular a cada render

### Alterações

**`src/hooks/useBroadcastLists.ts`**:
- Na função `useBroadcastLists`, após carregar as listas, executar queries de contagem para listas dinâmicas
- Para listas com tags: `SELECT count(*) FROM contacts JOIN contact_tags ON ... WHERE tag_id IN (...)`
- Para listas com source=funnel: contar via `funnel_deals`
- Atualizar `contact_count` com o valor real

**Secundário** — O filtro `source: "funnel"` sem `funnelId` é um cenário válido? Se não, adicionar validação no formulário `BroadcastListFormDialog.tsx` para exigir seleção de funil quando source="funnel".

### Detalhes técnicos
- A query de contagem usa `{ count: 'exact', head: true }` do Supabase para ser leve (não traz dados, só contagem)
- As 99 contacts com tag "igrejass" pertencem ao mesmo `user_id` que criou a lista — sem problema de RLS
- Sem alterações de banco de dados necessárias

