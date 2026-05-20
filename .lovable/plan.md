## Problemas identificados

### 1. Badge "Ocioso 46:59" mesmo com o usuário ativo
`useActivitySession` é chamado em **5 componentes diferentes** (`ActivityTracker`, `SessionStatusBadge`, `DashboardSidebar`, `MobileSidebarDrawer`, `Admin`). Como é um hook normal (não Context), **cada componente cria sua própria instância de estado**, com seus próprios:
- `lastActivityRef`
- `isIdle`/`isIdleRef`
- `setInterval` de inatividade
- listeners de eventos

Só o `ActivityTracker` registra listeners de mouse/teclado em `window`. O `SessionStatusBadge` **não tem listeners** — então o `lastActivityRef` dessa instância **nunca é atualizado** e, depois de 10 min do mount, o `checkInactivity` da própria instância marca `isIdle = true`. Resultado: badge mostra "Ocioso" eternamente, embora o `ActivityTracker` saiba que o usuário está ativo e o `last_activity` no banco esteja sendo gravado normalmente.

### 2. Painel de membros mostrando "Offline" e horas zeradas

Em `useMemberProductivity.ts`:

**Horas zeradas (sessões abertas):**
```ts
const dur = s.duration_seconds ?? (s.ended_at ? (ended-started)/1000 : 0);
```
Para a sessão de hoje (aberta: `ended_at = null`, `duration_seconds = null`) o cálculo retorna **0**. Ou seja, todo o trabalho do dia corrente não conta enquanto o usuário não fizer logout. Por isso "Horas trabalhadas" aparece zerado e o ranking individual também.

**Status "Offline":**
A regra usa `last_activity` da sessão aberta. Como `trackActivity` só persiste no DB a cada 2 minutos **e** muitos consumidores duplicados estão chamando `startSession` (que encerra a sessão atual e abre outra) — vimos no banco sessões de 30s sendo criadas em loop — frequentemente a sessão "aberta" mais recente tem `last_activity` antigo ou igual ao `started_at`, ultrapassando o threshold de 15 min ⇒ vira "Offline".

---

## Plano de correção

### A. Tornar `useActivitySession` um singleton via Context
Criar `ActivitySessionProvider` (montado uma única vez em `AppLayout`/`MobileAppLayout`) que:
- Mantém **um único** `currentSession`, `lastActivityRef`, `isIdle`, intervalos e listeners.
- Expõe `useActivitySession()` que apenas lê o context.
- Move os event listeners (mousedown/keydown/scroll/touchstart/mousemove) e a lógica de auto-start para dentro do provider, eliminando a necessidade do componente `ActivityTracker` (ou deixando-o como no-op para compatibilidade).
- Adiciona evento `visibilitychange` e `focus` da janela como sinais extras de atividade (volta de aba é sinal forte de presença).

Efeito: o badge passa a refletir o `isIdle` real (só vai para "Ocioso" depois de 10 min sem qualquer interação real do usuário).

### B. Reduzir intervalo de persistência de `last_activity`
Hoje: 2 min. Mudar para **30 s** (alinhado ao throttle de eventos). Isso garante que outros membros vejam o status atualizado quase em tempo real sem custo perceptível.

### C. Calcular corretamente horas de sessões abertas
Em `useMemberProductivity.ts`, para sessões **sem `ended_at`**:
```ts
const refEnd = s.ended_at
  ? new Date(s.ended_at).getTime()
  : Math.min(Date.now(), new Date(end).getTime()); // hoje: agora; range passado: fim do range
const dur = s.duration_seconds ?? Math.max(0, (refEnd - new Date(s.started_at).getTime()) / 1000);
```
Assim a sessão de trabalho em andamento conta as horas até `now()` (ou até o fim do range, se o range for histórico).

### D. Ajustar regra de status no painel
- `OFFLINE_THRESHOLD_MS`: 15 → **5 min** (mais coerente com persistência de 30 s).
- `IDLE_THRESHOLD_MS`: manter 10 min.
- Continuar usando o `last_activity` como sinal — agora confiável.
- Adicionar refetch automático no `useMemberProductivity` (`refetchInterval: 60_000`) para o painel "respirar" sem reload.

### E. Limpeza
- Remover a auto-criação concorrente de sessões quando múltiplos componentes ainda usavam o hook (resolvido pelo Provider).
- Manter `ActivityTracker` apenas como wrapper vazio para evitar quebrar imports existentes, ou removê-lo dos layouts.

---

## Arquivos a alterar

- `src/hooks/useActivitySession.ts` — refatorar em Provider + hook consumidor; intervalo de persistência 30 s.
- `src/components/productivity/ActivityTracker.tsx` — esvaziar (lógica migra para o Provider).
- `src/layouts/AppLayout.tsx` e `src/mobile/layouts/MobileAppLayout.tsx` — envolver com `<ActivitySessionProvider>`.
- `src/hooks/useMemberProductivity.ts` — calcular duração de sessões abertas; thresholds 5 min/10 min; `refetchInterval`.

Nenhuma mudança de schema é necessária.