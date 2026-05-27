# Padronização global de formato de data/hora

Objetivo: assim como o timezone, o **formato de data** e **formato de hora** passam a ser configurados em **Settings → Perfil/Organização** e respeitados por todo o app (frontend e edge functions). Default BR para todos os usuários.

## Onda 1 — Infraestrutura + Configuração (base)

**Banco**
- Migration em `organizations`:
  - `date_format text NOT NULL DEFAULT 'DD/MM/YYYY'` (opções: `DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD`)
  - `time_format text NOT NULL DEFAULT '24h'` (opções: `24h`, `12h`)
- Backfill: `UPDATE organizations SET date_format='DD/MM/YYYY', time_format='24h'` (garante BR pra todo mundo).

**Helpers centralizados**
- `src/lib/timezone.ts`: adicionar
  - `setActiveDateFormat`, `setActiveTimeFormat`, `getActiveDateFormat`, `getActiveTimeFormat`
  - `formatDate(value)` → ex. `27/05/2026`
  - `formatTime(value)` → ex. `14:30` ou `02:30 PM`
  - `formatDateTime(value)` → `formatDate + " " + formatTime`
  - `formatDateSmart(value)` → detecta date-only vs datetime
  - Todas respeitam timezone + formato ativos da org
- `src/hooks/useOrgTimezone.ts` (ou novo `useOrgDateTime.ts`): popular também `date_format`/`time_format` no cache global
- `src/components/TimezoneBootstrap.tsx`: já cobre, só usar o hook expandido
- `supabase/functions/_shared/timezone.ts`: espelhar com `resolveOrgDateFormat`, `formatDate`, `formatDateTime`, `formatDateSmart`

**Settings UI**
- Adicionar 2 selects (Formato de data / Formato de hora) na tela onde hoje fica o timezone (Profile/Organization settings)
- Preview ao vivo do exemplo formatado

**Chatbot (refatorar fix anterior)**
- `supabase/functions/execute-chatbot-flow/index.ts`: `formatVarValue` chama `formatDateSmart` do shared em vez da regex local

**Entrega:** infra pronta + configuração funcional + chatbot já consumindo o padrão. Peço **OK** antes de seguir.

---

## Onda 2 — Áreas core do app (frontend)

Substituir `toLocaleDateString`, `toLocaleString`, `new Date().toLocale*`, `date-fns format(...)` hardcoded em PT-BR pelos helpers centralizados, nestas áreas:
- `src/components/inbox/**` (bubbles, lista de conversas, anexos, tarefas)
- `src/components/calendar/**` e `src/pages/Calendar.tsx`
- `src/components/tasks/**` e `src/pages/Tasks.tsx`
- `src/hooks/useConversations.ts`, `useDealTasks.ts`, `useCalendarTasks.ts`, `useAllTasks.ts`

Critério: nenhuma string de data exibida nessas áreas com formato hardcoded.

**Entrega:** OK do usuário antes da próxima.

---

## Onda 3 — CRM, Campanhas, Financeiro

- `src/components/funnels/**`, `src/pages/Funnels.tsx` (cards de lead, datas de entrada/saída de etapa, custom fields tipo data)
- `src/components/contacts/**`
- `src/components/campaigns/**`, `src/pages/Campaigns.tsx` (agendamento, histórico, tracker)
- `src/components/financeiro/**`, `src/pages/Financeiro.tsx`, `src/pages/DebtorsManagement.tsx`
- `src/components/ssotica/**`
- `src/components/analysis/**`, `src/components/dashboard/**`

**Entrega:** OK do usuário antes da próxima.

---

## Onda 4 — Resto + Edge functions + QA

- Restante do `src/components/**` (templates, automations, warming, broadcasts, forms, admin, settings, instances, etc.)
- `src/lib/date-utils.ts`, `src/lib/pdf-export.ts` (PDFs/relatórios)
- Edge functions que escrevem datas em mensagens/notificações:
  - `send-whatsapp-notification`, `send-campaign-messages`, `process-scheduled-campaigns`, automations, AI agent prompts (datas em contexto), Asaas reminders
- QA final: grep no repo por `toLocaleDateString`, `toLocaleString(`, `format(.*'dd/MM`, `'pt-BR'` — só devem sobrar usos legítimos (ex.: parsing).
- Atualizar memória do projeto: regra "Formato de data/hora também vem da org (`organizations.date_format`/`time_format`); usar helpers `formatDate*` de `lib/timezone.ts` (frontend) e `_shared/timezone.ts` (edge). Nunca hardcodar."

**Entrega final:** todos os usuários existentes já em `DD/MM/YYYY` + `24h` (via backfill da Onda 1), com possibilidade de trocar.

---

## Detalhes técnicos

- **HTML/CSS:** sem mudança visual além do conteúdo da string.
- **i18n:** não estamos introduzindo i18n completo, só formato. Strings de UI continuam em PT-BR.
- **Compatibilidade:** helpers aceitam `string | number | Date | null | undefined` e retornam `""` quando inválido, evitando crash em telas que hoje usam `?? ""`.
- **Performance:** usa `Intl.DateTimeFormat` cacheado por (timezone, formato).
- **Sem mudar lógica de negócio:** datas continuam armazenadas em UTC/ISO; só a apresentação muda.

## Arquivos novos/principais

- `supabase/migrations/<ts>_org_datetime_format.sql`
- `src/lib/timezone.ts` (expandido)
- `supabase/functions/_shared/timezone.ts` (expandido)
- `src/hooks/useOrgTimezone.ts` (ou novo `useOrgDateTime.ts`)
- Settings UI (arquivo onde hoje fica o seletor de timezone)
- Varredura nas ondas 2–4 (sem novos arquivos, só substituições)

## Fora de escopo

- Não vou criar telas de admin para mudar formato de outras orgs (cada owner muda na própria).
- Não vou tocar em conteúdo de mensagens já enviadas (histórico no banco).