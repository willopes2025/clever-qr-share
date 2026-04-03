

## Plano: Total de leads filtrados + seletor de quantidade por página na lista do funil

### Situação atual

- A lista carrega 50 deals por etapa inicialmente, com botão "Carregar mais" para buscar os restantes
- O total de deals no funil (`totalDealsCount`) é calculado via RPC (`get_stage_deal_counts`), mas **não aparece de forma destacada** na interface
- Não existe seletor de quantidade de itens por página — sempre carrega de 50 em 50

### Mudanças

**Arquivo: `src/components/funnels/FunnelListView.tsx`**

1. **Exibir contagem total de leads filtrados** — Adicionar um indicador fixo acima da tabela mostrando:
   - Total de leads no funil (ex: "1.250 leads no funil")
   - Total de leads visíveis após filtros (ex: "342 leads filtrados")
   - Total de leads selecionados (ex: "15 selecionados")

2. **Seletor de quantidade por página** — Substituir o botão "Carregar mais" por um seletor de quantidade (50, 100, 200) que define quantos leads carregar de uma vez. Ao selecionar, o sistema carrega automaticamente todos os deals necessários para atingir essa quantidade (fazendo múltiplas chamadas se necessário).

3. **Botão "Carregar todos"** — Manter um botão para carregar todos os restantes de uma vez, caso o usuário queira ver tudo sem paginar.

**Arquivo: `src/hooks/useFunnelDeals.ts`**

4. **Aceitar parâmetro `limit`** na mutation `useLoadMoreDeals` para poder carregar mais que 50 por vez (usar o valor selecionado pelo usuário: 50, 100 ou 200).

### Detalhes técnicos

- O `DEALS_PER_PAGE` passa a ser dinâmico, controlado por um estado `pageSize` no componente
- A query `range()` do Supabase será ajustada para usar o novo limite
- O indicador de contagem usa `totalDealsCount` (do RPC) para o total real e `filteredDeals.length` para o total filtrado
- O seletor será um `<Select>` com opções: 50, 100, 200

