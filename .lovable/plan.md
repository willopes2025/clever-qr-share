

# Gráfico de Disparos de Lembretes no Dashboard Asaas

## Contexto
A tabela `billing_reminders` tem os campos necessários: `scheduled_for` (data do disparo), `reminder_type` (tipo), `status` (pending/sent/failed/cancelled), `sent_at`, `error_message`. Atualmente só existem registros `pending`, mas a estrutura suporta `sent` e `failed`.

## Plano

### 1. Criar componente `BillingRemindersChart`
Novo componente em `src/components/financeiro/BillingRemindersChart.tsx`:
- Consulta a tabela `billing_reminders` agrupando por `DATE(scheduled_for)`, `reminder_type` e `status`
- Exibe um **BarChart empilhado** (Recharts) com:
  - Eixo X: datas dos próximos 30 dias
  - Barras empilhadas por tipo de lembrete (`emitted`, `before_5d`, `due_day`, `after_1d`, `after_3d`, `after_5d`)
  - Cores diferenciadas por tipo
- Abaixo do gráfico, uma tabela resumo mostrando por status: **Pendentes**, **Enviados**, **Falhas**, **Cancelados**
- KPIs no topo: total de disparos pendentes, enviados com sucesso, com erro

### 2. Integrar no AsaasDashboard
- Importar e adicionar o `BillingRemindersChart` no `AsaasDashboard.tsx`, logo após o `RevenueChart`
- Usar o mesmo `dateRange` já existente no dashboard para filtrar os lembretes

### Detalhes técnicos
- Query Supabase: `supabase.from('billing_reminders').select('*').gte('scheduled_for', start).lte('scheduled_for', end)`
- Agrupar no frontend por data e tipo para montar os dados do gráfico
- Labels em português: Emissão, 5 dias antes, No vencimento, +1 dia, +3 dias, +5 dias
- Status com cores: verde (sent), amarelo (pending), vermelho (failed), cinza (cancelled)

