
# Revisão do Dashboard + Painel de Produtividade por Membro

## Contexto

Hoje o dashboard (`TraditionalDashboard.tsx`) já tem seções de overview, WhatsApp, leads, funil, financeiro, automações e um `AgentPerformanceSection` minimalista (top 5 atendentes). Existe também `TeamPerformanceTable` (não plugado no dashboard principal) e a tabela `user_performance_metrics` que já guarda mensagens enviadas/recebidas, conversas, deals, tarefas e tempo de trabalho por dia/usuário, além de `user_activity_sessions` (work/break/lunch/meeting/offline com duração).

O usuário (owner) quer mais visão e controle sobre o que cada membro está fazendo. Vou consolidar isso num painel novo dedicado, e revisar o restante do dashboard para coerência (não vou reescrever lógica de negócio, só ajustes de organização e estado vazio).

## O que será feito

### 1. Novo componente `MemberProductivitySection` (owner-only)

Card grande, agrupando todas as métricas por membro num único lugar — substitui o `AgentPerformanceSection` atual e absorve o `TeamPerformanceTable`.

Conteúdo:

- **KPIs do time (cards no topo)**: total horas trabalhadas, total mensagens enviadas, total mensagens recebidas, total conversas atendidas, total deals fechados, ticket médio, tempo médio de 1ª resposta.
- **Tabela "Produtividade por Membro"** com colunas filtráveis:
  - Membro (avatar + nome)
  - Horas trabalhadas (de `user_activity_sessions` tipo `work`)
  - Pausas (break + lunch)
  - Mensagens enviadas / recebidas (split em duas colunas)
  - Caracteres digitados (somatório do `length` de `inbox_messages.content` onde `from_me = true` e `sender_user_id = membro`) — métrica nova
  - Conversas atendidas / resolvidas
  - Tempo médio de 1ª resposta
  - Deals criados / ganhos / valor R$
  - Tarefas concluídas
  - Notas criadas (de `conversation_notes`)
  - Última atividade (relative time)
  - Status atual (online/pausa/almoço/offline) baseado em sessão aberta
- **Heatmap de horários ativos** (dia da semana × hora), por membro selecionado — usando `user_activity_sessions`.
- **Drill-down**: clicar num membro abre `MemberDetailDrawer` com gráfico diário de mensagens, conversas, tempo de resposta e timeline de sessões do período.

### 2. Sugestões adicionais de métricas (a incluir)

Além do que você pediu (mensagens enviadas/recebidas, tempo de trabalho, caracteres digitados, conversas), adiciono:

- Tempo médio e mediano de **primeira resposta** por membro (SLA)
- Tempo médio de **resolução** de conversa
- **Áudios enviados** vs texto vs mídia (split de `inbox_messages.message_type`)
- **Templates Meta** disparados pelo membro
- **Taxa de conversão** (deals ganhos / conversas atendidas)
- **Pico de atividade** (hora do dia com mais mensagens)
- **Conversas abandonadas** sob responsabilidade do membro
- **Tarefas criadas vs concluídas** + tarefas em atraso
- **Movimentações de funil** feitas pelo membro (de `funnel_deal_history`)
- **Notas e tags** adicionadas
- **Inatividade**: tempo desde a última mensagem enviada
- **Status atual** em tempo real (work / break / lunch / meeting / offline)

### 3. Nova hook `useMemberProductivity`

Em `src/hooks/useMemberProductivity.ts`. Para cada membro ativo da org no período:
1. Soma de `user_performance_metrics` (já tem messages_sent/received, conversations, deals, tasks, work seconds).
2. `user_activity_sessions` para horas detalhadas e status atual.
3. Query agregada em `inbox_messages` para **caracteres digitados**, áudios, templates, pico de hora.
4. `conversation_notes`, `funnel_deal_history`, `tasks` para complementos.
5. Escopo via `get_organization_member_ids(auth.uid())` (regra do projeto).

### 4. Revisão do dashboard existente

- `TraditionalDashboard.tsx`: substituir o par `AgentPerformanceSection + AlertsSection` pelo novo `MemberProductivitySection` em largura total; mover `AlertsSection` para baixo de `AutomationSection`.
- `OverviewSection`: adicionar KPI "Mensagens enviadas/recebidas (time todo)" no período.
- Estados vazios padronizados (mesmo componente em todas as seções).
- Skeletons unificados.
- Filtro de data já existe (`DashboardDateFilter`) — passar para a nova seção também.
- Visibilidade: a nova seção só aparece para owner/admin (`useUserRole`); membros comuns só veem suas próprias métricas (versão reduzida).

### 5. Arquivos novos / modificados

Novos:
- `src/components/dashboard/MemberProductivitySection.tsx`
- `src/components/dashboard/MemberDetailDrawer.tsx`
- `src/components/dashboard/MemberActivityHeatmap.tsx`
- `src/hooks/useMemberProductivity.ts`

Modificados:
- `src/components/dashboard/TraditionalDashboard.tsx` (recompor layout)
- `src/components/dashboard/OverviewSection.tsx` (KPIs de mensagens do time)
- `src/components/dashboard/AgentPerformanceSection.tsx` (deprecar/remover)
- `src/hooks/useDashboardMetricsV2.ts` (expor agregados extras se faltar)

### 6. Performance e RLS

- Todas as queries usam `organization_id` e RLS já existente em `user_performance_metrics` e `user_activity_sessions`.
- "Caracteres digitados" e agregados em `inbox_messages` ficam atrás de `useQuery` com `staleTime` de 60s para não pesar.
- Período padrão: 7d (igual ao dashboard atual). Para "today" o status atual é em tempo real via realtime já configurado em `user_activity_sessions`.

## Detalhes técnicos

- Sem migração de DB necessária — todas as métricas saem de tabelas existentes.
- "Caracteres digitados" = `SUM(char_length(content))` em `inbox_messages` filtrado por `from_me = true` e `sender_user_id`. Se `sender_user_id` não estiver populado em mensagens antigas, fallback para `instance_id → user_id`.
- Status em tempo real: subscribe em `user_activity_sessions` filtrado por `organization_id`.

## Fora de escopo

- Não vou alterar o tracking em si (ActivityTracker já existe e popula as tabelas).
- Não vou criar gravação de tela / keystroke logger — apenas agregados já capturados.
- Não vou mexer no dashboard mobile (`MobileHome`) nesta etapa.
