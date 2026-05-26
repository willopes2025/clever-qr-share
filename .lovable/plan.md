# Fuso horário unificado em toda a plataforma

Hoje cada parte do sistema trata fuso de um jeito: o frontend usa `America/Sao_Paulo` fixo, algumas edge functions hardcodam `-03:00`, campanhas leem `campaign.timezone`, e a tela de Configurações já tem o seletor de fuso (`user_settings.timezone`) — mas ninguém respeita o que o usuário escolheu lá. A regra agora será: **o fuso do dono da organização vale para todo o sistema, em todas as telas e em todas as automações/agendamentos**, sem criar rotas/edge functions novas.

## O que muda para o usuário

- O seletor de fuso em **Configurações → Perfil** passa a ser a fonte única de verdade. Só o dono da organização edita; membros veem em modo leitura.
- Todos os horários exibidos (inbox, kanban, dashboards, listas de tarefas, datas em cards) passam a respeitar esse fuso.
- Todos os campos de **data + hora** em formulários (automações “Em data e hora exata”, “Diariamente às”, “Antes/Depois de campo de data”, campanhas, tarefas/calendário, horários permitidos de envio) interpretam o valor digitado nesse fuso.
- O cron de automações/campanhas dispara baseado no fuso da organização (não mais no UTC do servidor nem em um offset chumbado).

## Onde está o problema hoje (auditoria)

1. `supabase/functions/process-scheduled-automations/index.ts` — usei `-03:00` chumbado no fix anterior. Precisa ler o fuso da org da automação.
2. `supabase/functions/send-campaign-messages/index.ts` — já usa `campaign.timezone`, mas o default é `America/Sao_Paulo`. Trocar default para o fuso da org.
3. `supabase/functions/send-whatsapp-notification/index.ts` — recebe `timezone` por parâmetro com default BRT. Quem chama precisa passar o fuso da org.
4. `supabase/functions/process-scheduled-task-messages`, `process-notification-queue`, `process-warming`, `resume-scheduled-flows` — se interpretam data/hora, mesmo tratamento.
5. `src/lib/date-utils.ts` — todas as funções de exibição estão chumbadas em `America/Sao_Paulo`. Trocar para ler de um store global alimentado por `useUserSettings`.
6. Componentes de formulário com `<input type="datetime-local">` / `type="date"` + `type="time"` (AutomationFormDialog, CampaignFormDialog, CreateTaskDialog, DealFormDialog, SendingSettings, BulkEditDialog): hoje montam ISO sem indicar fuso, o que faz o backend tratar como UTC. Passar a montar o ISO **convertendo do fuso da org para UTC** antes de salvar.

## Onde guardar o fuso da organização

Sem rota nova: adicionar coluna `timezone TEXT DEFAULT 'America/Sao_Paulo'` em `public.organizations` e popular com o `user_settings.timezone` do `owner_id` (one-shot UPDATE). A partir daí toda leitura usa `organizations.timezone`.

- UI em ProfileSettings continua existindo, mas para o dono ela passa a gravar em `organizations.timezone` (além de manter em `user_settings` para retrocompat).
- Membros só visualizam o fuso da org (somente leitura).

## Helpers compartilhados (sem rota nova)

**Frontend** (`src/lib/timezone.ts`, novo arquivo utilitário):
- `getOrgTimezone()` — lê via `useOrganization` (já existe) e cacheia.
- `toUtcFromOrgTz(dateStr, timeStr)` — converte “2026-05-26” + “16:46” no fuso da org para um `Date` UTC correto (substitui `new Date('YYYY-MM-DDTHH:mm:00')`).
- `formatInOrgTz(date, pattern)` — substitui as helpers chumbadas em `date-utils.ts`. As funções existentes (`formatBrazilDate`, etc.) viram thin wrappers que chamam isso.

**Edge functions** (`supabase/functions/_shared/timezone.ts`, novo arquivo compartilhado):
- `resolveOrgTimezone(supabase, { userId? | organizationId? | dealId? | automationId? })` — devolve a string IANA (`America/Sao_Paulo` por default).
- `parseInTimezone(dateStr, timeStr, tz)` — converte data+hora local da org para `Date` UTC (usando `Intl.DateTimeFormat` para descobrir o offset correto, inclui DST quando o fuso tiver).
- `nowInTimezone(tz)` — devolve `{ year, month, day, hour, minute, weekday }` do “agora” na org.

Aplicar em todas as edge functions listadas acima.

## Passos

1. **Migration**: adicionar `organizations.timezone` (default `America/Sao_Paulo`, NOT NULL). Backfill com o valor atual do `user_settings.timezone` do `owner_id`.
2. **ProfileSettings**: se o usuário logado é owner, salvar no `organizations.timezone`. Para não-owners, mostrar o fuso da org (read-only) com uma nota “definido pelo dono da conta”.
3. **Helpers**: criar `src/lib/timezone.ts` e `supabase/functions/_shared/timezone.ts`.
4. **Refatorar frontend**: substituir hardcodes em `src/lib/date-utils.ts` e adaptar os formulários com `datetime-local`/`date`+`time` para converter via `toUtcFromOrgTz` antes de salvar e via `formatInOrgTz` na exibição.
5. **Refatorar edge functions** uma a uma para usar `resolveOrgTimezone` + `parseInTimezone`:
   - `process-scheduled-automations` (remove o `-03:00` chumbado)
   - `send-campaign-messages` (default vira tz da org)
   - `send-whatsapp-notification`, `process-scheduled-task-messages`, `process-notification-queue`, `process-warming`, `resume-scheduled-flows`
6. **Memória**: atualizar Core (`System Timezone`) para “fuso da organização (`organizations.timezone`)” e criar leaf `mem://infrastructure/timezone-org-resolution` com as regras de resolução.

## Não está no escopo

- Não vou criar novas edge functions / rotas.
- Não vou mexer em integrações externas (Google Calendar, Asaas) — já recebem ISO com offset correto.
- Histórico antigo de mensagens/logs continua armazenado em UTC — só a exibição muda.

## Observação

Para o caso específico que motivou a investigação (automação “Mover lead por hora” 16:46): com `organizations.timezone = 'America/Sao_Paulo'` e o `parseInTimezone` correto, o cron vai disparar exatamente às 16:46 BRT independente do servidor estar em UTC, e se você mudar o fuso para outro (ex: `America/Manaus`) tudo no sistema acompanha.
