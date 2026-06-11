## Objetivo

Permitir que o usuário configure, dentro da página **Análises**, o envio automático do relatório de atendimento em PDF via WhatsApp para um ou mais membros selecionados, com frequência **diária, a cada 7, 15 ou 30 dias**.

## Onde fica a configuração

Novo card **"Relatórios Automáticos"** logo abaixo de "Gerar Novo Relatório" na página `src/pages/Analysis.tsx`. Mantém todo o fluxo concentrado num único lugar, sem precisar criar nova rota/sidebar.

O card lista os agendamentos existentes e tem um botão "Novo agendamento" que abre um dialog.

## UX do agendamento

Dialog `ScheduledAnalysisDialog` com:

- **Nome do agendamento** (texto livre).
- **Frequência**: Diário · A cada 7 dias · A cada 15 dias · A cada 30 dias.
- **Horário de envio** (HH:MM, padrão 08:00, no fuso da organização).
- **Destinatários** (multi-select de membros da organização — usa `useTeamMembers`).
- **Escopo da análise**: mesma lógica do envio manual (incluir campanhas, SLA, transcrever áudios).
- **Ativo / Pausado** (switch).

Cada linha da lista mostra: nome, frequência, próximos disparos, destinatários, último envio + botões editar/pausar/excluir/"Enviar agora".

## Modelo de dados (nova tabela)

```text
scheduled_analysis_reports
  id uuid pk
  organization_id uuid
  user_id uuid (criador)
  name text
  frequency text  -- 'daily' | 'weekly' | 'biweekly' | 'monthly'
  send_time time  -- hora local da org
  recipient_user_ids uuid[]  -- membros que recebem
  include_campaigns bool
  include_sla bool
  transcribe_audios bool
  is_active bool
  last_run_at timestamptz
  next_run_at timestamptz
  created_at / updated_at
```

RLS: somente membros da mesma `organization_id` (via `get_organization_member_ids`). GRANT padrão para `authenticated` e `service_role`.

## Backend

1. **Edge function `send-scheduled-analysis`**
   - Recebe `{ schedule_id }`.
   - Calcula `periodStart`/`periodEnd` conforme frequência (1, 7, 15 ou 30 dias).
   - Reaproveita `analyze-conversations` para gerar o relatório (insere em `conversation_analysis_reports`) e aguarda conclusão.
   - Gera o PDF no servidor (porta da lógica de `src/lib/pdf-export.ts` para Deno usando `pdf-lib` ou serializa via `jsPDF` server-side) e faz upload no bucket `inbox-media`.
   - Para cada `recipient_user_id`: localiza o telefone do membro (`profiles`/`team_members`) e envia o PDF como documento WhatsApp pela instância padrão da organização (mesmo helper usado em campanhas — respeita Evolution/Meta).
   - Atualiza `last_run_at` e recalcula `next_run_at`.

2. **Cron pg_cron a cada 5 min** (`scheduled_analysis_dispatcher`)
   - Seleciona schedules com `is_active = true AND next_run_at <= now()` e invoca a edge function via `pg_net`.

## Frontend

- `src/hooks/useScheduledAnalysisReports.ts` — CRUD + "run now".
- `src/components/analysis/ScheduledReportsCard.tsx` — card na página.
- `src/components/analysis/ScheduledAnalysisDialog.tsx` — formulário criar/editar.
- Integra em `src/pages/Analysis.tsx` abaixo do card de geração manual.

## Detalhes técnicos

- Frequências mapeadas para dias: daily=1, weekly=7, biweekly=15, monthly=30. `periodStart = next_run_at - N dias`.
- `next_run_at` calculado em `America/Sao_Paulo`/timezone da org (`organizations.timezone`) usando helpers existentes.
- Envio WhatsApp segue regra híbrida `meta:`/`evo:` já usada no projeto; áudio/documento usa MIME `application/pdf` e nome `analise-YYYY-MM-DD.pdf`.
- PDF reusa o layout atual: extrair função pura `buildAnalysisPdfBytes(report)` em `src/lib/pdf-export.ts` que rode tanto no browser quanto numa versão Deno (via `npm:jspdf`).

## Fora do escopo

- Envio por e-mail ou notificação in-app (foco apenas em WhatsApp, conforme escolha).
- Edição do conteúdo do PDF (mantém o mesmo formato do botão "Download" atual).
