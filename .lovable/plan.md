

## Análise do Dashboard - Problemas Encontrados e Plano de Melhoria

### Problemas nos Cálculos Atuais

**1. Leads Section (`useLeadMetrics`) ignora o `dateRange` selecionado**
- `leadsToday`, `leadsWeek`, `leadsMonth` usam sempre datas fixas (hoje, início da semana, início do mês) em vez de respeitar o filtro de período selecionado pelo usuário.
- `leadsBySource` busca **todos** os deals sem filtro de data.
- `duplicateLeads` busca **todos** os contatos sem filtro de data.
- `reactivatedLeads` usa sempre 7 dias fixos.

**2. WhatsApp Section (`useWhatsAppMetrics`) - `deliveryRate` imprecisa**
- A taxa de entrega conta mensagens com status `sent` e `received` como "entregues", mas `sent` significa apenas que foi enviado, não entregue. Deveria usar `delivered` ou `received`.

**3. Funnel Section (`useFunnelMetrics`) - não filtra deals por data**
- Busca **todos** os deals dos stages, ignorando o `dateRange`. Contagens de "Em Negociação", "Vendas Fechadas" e "Perdidos" mostram dados históricos totais, não do período selecionado.

**4. Financial Section (`useFinancialMetrics`) - pipeline sem filtro de data**
- `valueInNegotiation` e `estimatedRevenue` consideram **todos** os deals abertos, não apenas os do período.

**5. Overview Section - `activeConversations` sem filtro de data**
- Conta todas as conversas abertas independente do período selecionado.

**6. Response Time (`useOverviewMetrics`) - limitado a 1000 mensagens**
- O cálculo de tempo de resposta busca apenas 1000 mensagens, o que pode dar resultados distorcidos em períodos longos (90d).

**7. Agent Performance - média de tempo de resposta incorreta**
- Calcula média simples entre agentes em vez de média ponderada pelo volume de atendimentos.

---

### Plano de Implementação

#### 1. Adicionar filtro de data personalizado (após 90 dias)

**Mudanças no tipo `DateRange`:**
- Alterar `DateRange` em `useDashboardMetricsV2.ts` para aceitar `'today' | '7d' | '30d' | '90d' | 'custom'`
- Criar um novo state no `TraditionalDashboard` para armazenar `customDateRange: { from: Date; to: Date } | null`
- Atualizar `getDateRange()` para aceitar um parâmetro opcional de datas customizadas
- Passar as datas customizadas para todos os hooks

**Mudanças no `DashboardDateFilter`:**
- Adicionar botão "Personalizado" com ícone de calendário
- Usar `Popover` + `Calendar` (mode="range") como já existe no `SsoticaDateFilter`
- Mostrar as datas selecionadas quando em modo personalizado

#### 2. Corrigir cálculos dos KPIs

**`useLeadMetrics`:**
- Fazer `leadsToday/leadsWeek/leadsMonth` respeitar o dateRange ou remover redundância (já que Overview mostra leads do período)
- Filtrar `leadsBySource` pelo período selecionado
- Filtrar `duplicateLeads` pelo período selecionado

**`useFunnelMetrics`:**
- Filtrar deals por `created_at` dentro do período selecionado

**`useFinancialMetrics`:**
- Manter `valueInNegotiation` como total (faz sentido para pipeline) mas deixar claro no label

**`useWhatsAppMetrics`:**
- Revisar status de entrega para usar os status corretos do banco

**`useAgentPerformanceMetrics`:**
- Corrigir cálculo de média de tempo de resposta para usar média ponderada global

---

### Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| `src/hooks/useDashboardMetricsV2.ts` | Tipo `DateRange` + `getDateRange()` aceitar custom + correções nos cálculos |
| `src/hooks/useAdvancedDashboardMetrics.ts` | Alinhar tipo `DateRange` com custom |
| `src/components/dashboard/DashboardDateFilter.tsx` | Adicionar opção "Personalizado" com calendar range picker |
| `src/components/dashboard/TraditionalDashboard.tsx` | State para custom dates, passar para todos os componentes |
| `src/components/dashboard/LeadsSection.tsx` | Adaptar à nova interface |
| Demais seções do dashboard | Adaptar à nova assinatura de props se necessário |

