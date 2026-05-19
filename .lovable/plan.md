
## 1. Status "Ocioso" após 10 minutos sem digitar

**Onde:** `src/hooks/useActivitySession.ts` e `src/components/productivity/SessionStatusBadge.tsx`

- Adicionar estado derivado `isIdle` no hook `useActivitySession`:
  - Verificar inatividade a cada 30s (em vez de só checar 30min).
  - Se sessão for `work` e `lastActivityRef` > 10 min sem evento → marcar `isIdle = true` e atualizar coluna `last_activity` (mas NÃO encerrar a sessão).
  - Quando o usuário voltar a interagir (`trackActivity`) → `isIdle = false`.
  - Manter o encerramento automático atual em 30min (ou ajustar para 60min, opcional).
- Adicionar nova coluna opcional `is_idle boolean default false` em `user_activity_sessions` para que admins vejam o status real em tempo real (atualizada junto com `last_activity`).
- Em `SessionStatusBadge`:
  - Quando `isIdle` for true e houver sessão `work`, exibir badge **"Ocioso"** (ícone `Moon` ou `PauseCircle`, cor `bg-slate-500/10 text-slate-500`) ao invés de "Trabalhando".
  - Mantém o cronômetro rodando.
- Em `MemberProductivitySection.tsx` e `useMemberProductivity.ts`:
  - Adicionar tipo de status `'idle'` em `currentStatus`.
  - Lógica: se há sessão `work` ativa mas `last_activity` > 10min → status = `idle` (label "Ocioso").
  - Substituir o label "Offline" do badge atual por "Ocioso" apenas quando o usuário tem sessão ativa porém parada; "Offline" continua para quem não tem sessão alguma. (User pediu "ao invés de aparecer offline aparece Ocioso" — interpretado como: quem está logado mas ficou 10min parado vira Ocioso, não Offline.)

## 2. Novo gráfico: Mensagens enviadas por hora

**Novo componente:** `src/components/dashboard/MessagesByHourChart.tsx`

- Card com:
  - Título "Mensagens enviadas por hora"
  - Toggle (Tabs ou Select) com 2 modos:
    - **Geral** — barras únicas por hora, somando todos os usuários.
    - **Por usuário** — barras agrupadas/empilhadas por hora, uma cor por usuário, com legenda.
  - Filtro de data usa o `dateRange`/`customRange` já vindos do dashboard (mesma faixa dos outros widgets).
- Gráfico em barras (Recharts `BarChart`) — eixo X = 0h..23h, eixo Y = nº de mensagens.
- Cores via tokens do design system (`hsl(var(--primary))`, `--chart-1..5` etc.).

**Novo hook:** `src/hooks/useMessagesByHour.ts`

- Query nas `inbox_messages` (direction='outbound') agrupando por `EXTRACT(HOUR FROM sent_at AT TIME ZONE 'America/Sao_Paulo')` e `sent_by_user_id`.
- Reusa autorização via `get_organization_member_ids` (já presente em outras queries).
- Implementação: criar RPC `get_messages_by_hour(p_start, p_end)` retornando `(user_id uuid, hour int, count bigint)` — segue padrão do `get_member_message_productivity`.
- Hook retorna 2 estruturas memoizadas:
  - `aggregate`: array com 24 itens `{ hour, total }`.
  - `byUser`: array com 24 itens `{ hour, [userName]: count, ... }` + lista `users[]` para legenda.

**Integração:** `TraditionalDashboard.tsx`

- Adicionar `<MessagesByHourChart dateRange={dateRange} customRange={customRange} />` em um novo bloco logo abaixo de `MemberProductivitySection`.

## Detalhes técnicos

- Migration necessária:
  - `ALTER TABLE user_activity_sessions ADD COLUMN is_idle boolean NOT NULL DEFAULT false;`
  - Criar função `get_messages_by_hour(p_start timestamptz, p_end timestamptz)` (SECURITY DEFINER, mesmo padrão de autorização do `get_member_message_productivity`).
- Throttle: o update de `is_idle` no DB acontece junto com o update de `last_activity` que já existe (a cada 2min). Quando idle vira true, faz 1 update extra imediato; idem ao voltar a digitar.
- Eventos rastreados para `trackActivity`: já existem listeners globais nos layouts (manter); confirmar `mousemove`, `keydown`, `click`, `scroll`.
- Sem mudanças em business logic de mensagens — apenas leitura agregada.

## Fora de escopo

- Não alterar lógica de fechamento de sessões abandonadas (`close_abandoned_sessions`).
- Não mudar o cálculo de horas trabalhadas existente (problema separado já discutido).
