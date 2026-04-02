

## Plano: Correção do Dashboard — Dados inconsistentes com a realidade

### Problemas identificados com dados reais

Comparei as queries do dashboard com os dados reais do banco:

**1. Taxa de entrega WhatsApp está errada (~2% quando deveria ser ~10%+)**
- O código conta apenas status `delivered` e `received` (162 msgs)
- Ignora status `read` (460 msgs) — se foi lido, foi entregue
- Também ignora `sent` (7.272 msgs) que indica envio bem-sucedido ao servidor
- **Fix**: incluir `read` como entregue. Considerar `sent` separadamente.

**2. Funil mostra apenas deals criados no período, não o estado atual do pipeline**
- A query filtra `funnel_deals` por `created_at` no período selecionado
- Resultado: "Em Negociação" mostra apenas deals novos, não o pipeline real
- O pipeline real tem 7.777 deals; o dashboard mostra apenas ~1.500
- **Fix**: remover filtro de `created_at` para métricas de pipeline atual (Em Negociação, valor). Manter filtro apenas para Vendas Fechadas/Perdidas (usar `closed_at`)

**3. Atendimentos Automáticos mostra 0 (correto nos dados, mas a lógica é frágil)**
- `ai_handled = true` nos últimos 7 dias = 0
- A lógica depende de `ai_handled` ser setado no momento correto. Confirmo que os dados refletem isso, mas é consistente.

**4. Taxa de resposta limitada a 1.000 mensagens**
- A query de `inbox_messages` tem `limit(1000)` mas existem 8.178+ outbound msgs nos últimos 7 dias
- Isso trunca o cálculo de taxa de resposta e tempo médio
- **Fix**: usar contagem por query separada em vez de carregar todas as mensagens

**5. Financeiro: muitos deals com valor 0**
- 498 deals têm valor > 0 (total R$362K), mas 7.279 têm valor = 0
- O dashboard mostra valores baixos porque calcula médias incluindo deals sem valor
- **Fix**: filtrar deals com `value > 0` para ticket médio

---

### Correções planejadas

#### Arquivo: `src/hooks/useDashboardMetricsV2.ts`

**WhatsApp Metrics (linha ~183-189)**
- Adicionar `read` à lista de status "entregues": `.in('status', ['delivered', 'received', 'read'])`

**Funnel Metrics (linha ~369-374)**  
- Separar queries: pipeline atual (sem filtro de data) vs. deals ganhos/perdidos no período (filtrar por `closed_at`)
- Stages mostram contagem ATUAL, não apenas do período

**Overview — Taxa de resposta (linha ~101-141)**
- Substituir a abordagem de carregar 1.000 mensagens por queries de contagem separadas:
  - Total de conversas no período
  - Conversas com pelo menos 1 resposta outbound no período

**Financial — Ticket médio (linha ~666)**
- Filtrar `value > 0` ao calcular ticket médio para não distorcer com deals sem valor

### Arquivo a modificar

1. `src/hooks/useDashboardMetricsV2.ts` — 4 correções nas queries de métricas

