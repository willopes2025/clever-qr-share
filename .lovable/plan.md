

# Expandir Gráfico de Lembretes para Incluir Previsão Futura

## Problema
O gráfico atual filtra os lembretes apenas pelo período do dashboard (últimos 30 dias). O usuário quer ver também os disparos **futuros** provisionados, espelhando o mesmo intervalo para frente (ex: se o dashboard mostra 30 dias para trás, o gráfico mostra 30 dias para frente).

## Plano

### 1. Alterar a query do `BillingRemindersChart`
No `useEffect` do componente, calcular o período futuro com base no intervalo do `dateRange`:
- Calcular a quantidade de dias do período selecionado (`differenceInDays(dateRange.end, dateRange.start)`)
- Buscar lembretes desde `dateRange.start` até `addDays(today, diasDoPeriodo)` — ou seja, inclui passado + futuro
- Isso garante que se o dashboard está em 30 dias, o gráfico mostra do início do período até 30 dias no futuro

### 2. Separar visualmente passado e futuro no gráfico
- Adicionar uma linha vertical de referência (ReferenceLine do Recharts) no dia de hoje para distinguir "já aconteceu" de "previsão"
- Opcionalmente, barras futuras com leve opacidade diferente

### Detalhes técnicos
- Arquivo: `src/components/financeiro/BillingRemindersChart.tsx`
- Usar `differenceInDays` e `addDays` do date-fns (já importado)
- Adicionar `ReferenceLine` do Recharts no eixo X na data de hoje
- A query passa a usar: `.gte('scheduled_for', dateRange.start.toISOString()).lte('scheduled_for', addDays(new Date(), days).toISOString())`

