

## Correção dos Números do Dashboard Financeiro

### Problemas Identificados

1. **Taxa de Inadimplência inflada (98.3%)**: O cálculo atual compara o total de cobranças vencidas de **todos os tempos** contra apenas os recebimentos **do período selecionado**. Isso distorce completamente a taxa.
   - Fórmula atual: `overdueTotal / (receivedInPeriod + overdueTotal)` → mistura períodos diferentes
   - Exemplo: R$ 151k vencidos (histórico total) vs R$ ~2k recebidos (30 dias) = 98.3%

2. **Aging e Total Vencido sem filtro de período**: O aging e o total vencido consideram **todas** as cobranças OVERDUE da base, independente do período selecionado no filtro de datas, o que pode incluir cobranças muito antigas que já foram renegociadas ou são incobráveis.

3. **"Total de cobranças" e "Valor total" no resumo**: Mostram o total de TODOS os payments da base Asaas, não apenas os do período.

### Correções Propostas

**Arquivo:** `src/hooks/useFinancialMetrics.ts`

| Métrica | Antes | Depois |
|---------|-------|--------|
| Taxa de Inadimplência | `overdueTotal / (received + overdueTotal)` | `overdueNoPeriodo / totalFaturadoNoPeriodo` — considerar apenas cobranças com vencimento no período |
| Total Vencido | Todos os OVERDUE da base | Cobranças OVERDUE com vencimento dentro do período selecionado |
| Aging | Todos os OVERDUE | Mantém todos os OVERDUE (faz sentido ser visão geral), mas adicionar label "Visão Geral" |
| Resumo do Período | Todos os payments | Apenas payments com vencimento ou pagamento dentro do período |

**Detalhes da correção principal (inadimplência):**
```
// Cobranças com vencimento no período
const billedInPeriod = payments.filter(p => 
  isPaymentInRange(p, dateRange, false) // usa dueDate
);
const totalBilledInPeriod = billedInPeriod.reduce((sum, p) => sum + p.value, 0);

// Vencidas com dueDate no período  
const overdueInPeriod = billedInPeriod.filter(p => p.status === 'OVERDUE');
const overdueInPeriodTotal = overdueInPeriod.reduce((sum, p) => sum + p.value, 0);

// Taxa correta
const delinquencyRate = totalBilledInPeriod > 0 
  ? (overdueInPeriodTotal / totalBilledInPeriod) * 100 : 0;
```

**KPI "Total Vencido"** passará a mostrar apenas vencidos do período, com subtitle indicando o período. O aging continuará mostrando a visão geral (todos os vencidos) pois é útil para gestão de cobrança.

