## Objetivo

Criar um módulo "Relatórios Dinâmicos" onde o usuário monta um relatório escolhendo:
1. **Fonte + variável** (campo personalizado de contato, de deal, resposta de formulário, tag ou etapa do funil)
2. **Período** (hoje, amanhã, últimos 3/7/30 dias, próximos 7 dias, este mês, mês passado, intervalo customizado)
3. **Destinatários** (membros da organização)
4. **Canal de entrega** (sino no sistema com PDF anexo, WhatsApp com PDF anexo, ou ambos)
5. **Execução** (rodar agora ou agendar recorrente — diária/semanal/mensal)

O relatório é gerado como PDF no servidor e entregue por notificação interna (com link de download do PDF salvo em Storage) e/ou WhatsApp (documento anexo pelo chip do destinatário).

## Onde vive na UI

Nova página `/relatorios-dinamicos` (menu lateral, ao lado de "Análises"). Estrutura:

```text
┌─ Relatórios Dinâmicos ──────────────────────────┐
│ [Novo relatório]                                │
│                                                 │
│ Meus relatórios salvos                          │
│  • Vencimentos da semana   diário 08:00  ▶ ⚙   │
│  • Inscritos exame vista   semanal seg   ▶ ⚙   │
│                                                 │
│ Últimas execuções                               │
│  • 06/07 08:00 · 12 leads · [PDF] · enviado    │
└─────────────────────────────────────────────────┘
```

Diálogo "Novo relatório" em passos:
1. **Nome + descrição**
2. **Fonte**: Contatos · Deals · Formulários · Tags/Etapa
3. **Variável/filtro** (depende da fonte):
   - Contatos → dropdown com `custom_field_definitions` do usuário (tipo `date`, `datetime`, `select`, `text`…); condição (é igual a, contém, está entre datas, vence em)
   - Deals → mesma coisa em `funnel_deals.custom_fields` + funil/etapa opcional
   - Formulários → escolhe o formulário; opcionalmente filtra por resposta de um campo
   - Tags/Etapa → seleciona uma ou mais tags OU etapa de um funil
4. **Período**: chips (Hoje, Amanhã, Últimos 3/7/30, Próximos 7, Este mês, Mês passado) + opção "Intervalo customizado" com dois date pickers. Todo cálculo usa `America/Sao_Paulo` (regra do projeto).
5. **Colunas do PDF**: checkboxes com campos disponíveis da fonte (nome, telefone, e-mail, valor do deal, data do campo escolhido, tag, responsável…).
6. **Destinatários**: multi-select de membros da organização (usa `get_organization_member_ids`); para cada um marca canal (sino, WhatsApp, ou ambos). WhatsApp usa o telefone do `profiles` do destinatário e é disparado pelo chip padrão do owner.
7. **Execução**: "Enviar agora" ou "Agendar" (frequência: diária/semanal/mensal + hora + dias da semana quando semanal). O agendamento cria linha em `pg_cron` chamando a edge function (mesmo padrão de `scheduled_analysis_reports`).

Após salvar, botão "Rodar agora" gera na hora e mostra preview do resultado antes de enviar.

## Entrega ao destinatário

- **Sino (notificação interna)**: insere linha em `notification_queue` / `notification_log` com título "Relatório: {nome} — {período}", corpo com resumo (X leads encontrados), e link para o PDF em Storage. O ícone de notificações existente já renderiza isso.
- **WhatsApp**: envia documento PDF via edge function `send-inbox-media` (já existente) usando o chip do owner da organização e o telefone do destinatário como `to`. Se o destinatário não tiver telefone no `profiles`, cai só para o sino e mostra aviso.

## Modelo de dados (migração)

```text
public.dynamic_reports
  id, user_id, organization_id, name, description
  source ('contacts' | 'deals' | 'form_submissions' | 'tags_stage')
  filter_config jsonb   -- { field_id, operator, value, form_id, funnel_id, stage_id, tag_ids }
  period_config jsonb   -- { preset: 'today'|'last_7d'|..., custom_start, custom_end }
  columns text[]
  schedule_config jsonb -- { enabled, frequency, hour, weekdays, monthday }
  created_at, updated_at

public.dynamic_report_recipients
  id, report_id, user_id, channels text[]  -- ['bell','whatsapp']

public.dynamic_report_runs
  id, report_id, triggered_by, executed_at,
  period_start, period_end, row_count,
  pdf_storage_path, status ('success'|'failed'), error
```

- Enable RLS + GRANTs padrão em todas.
- Policies escopadas por `organization_id` via `get_organization_member_ids(auth.uid())`.
- Bucket privado no Storage `dynamic-reports` para os PDFs; políticas escopadas por org.

## Backend (edge functions)

1. **`preview-dynamic-report`** (síncrona, chamada pelo botão "Prévia"): recebe `filter_config` + `period_config`, resolve o período respeitando `organizations.timezone` (usa `_shared/timezone.ts`), monta o SELECT correto por fonte e retorna as linhas + colunas.
2. **`run-dynamic-report`**: mesma consulta da preview + geração de PDF (usa `jspdf`, já instalado no projeto) com header (logo, nome do relatório, período, contagem), tabela paginada e rodapé. Salva PDF no bucket, cria linha em `dynamic_report_runs`, dispara entrega para cada destinatário nos canais escolhidos. Usa `EdgeRuntime.waitUntil` para envios paralelos.
3. **`schedule-dynamic-reports-tick`**: chamada por `pg_cron` a cada 5 min; lê relatórios com `schedule_config.enabled=true` cuja próxima execução caiu no minuto atual (calculada em `America/Sao_Paulo`) e enfileira chamadas para `run-dynamic-report`.

Todas com auth via `supabaseClient.auth.getUser()`, CORS padrão, e organização resolvida com `resolve_user_organization_id`.

## Frontend (arquivos novos)

- `src/pages/DynamicReports.tsx` — lista + gatilho para criar
- `src/components/dynamic-reports/DynamicReportDialog.tsx` — wizard de 6 passos
- `src/components/dynamic-reports/DynamicReportPreview.tsx` — tabela + botão "Enviar"
- `src/components/dynamic-reports/DynamicReportRunsList.tsx` — histórico de execuções
- `src/hooks/useDynamicReports.ts` — CRUD + `runNow` + `preview`
- Rota adicionada em `src/App.tsx` protegida por `PermissionGate` com nova permissão `view_dynamic_reports` (adicionada em `src/config/permissions.ts`)
- Item no menu lateral (usar ícone `FileBarChart` da lucide)

## Reuso do que já existe

- Cálculo de período/timezone: `supabase/functions/_shared/timezone.ts`
- Definições de campos: `custom_field_definitions` (já lidas por `useCustomFields`)
- Formulários e submissões: `forms`, `form_submissions`, `form_fields`
- Escopo de organização: `get_organization_member_ids`
- WhatsApp com anexo: `send-inbox-media` (já suporta documento)
- Notificações internas: `notification_queue` + provider existente

## Fora do escopo desta entrega

- E-mail com PDF (usuário não marcou).
- Edição de PDF por template — o layout do PDF é fixo com identidade do sistema; ajustes visuais depois.
- Compartilhar relatório com destinatários externos (não-membros).

## Ordem de implementação

1. Migração das 3 tabelas + bucket + policies + permissão.
2. Edge function `preview-dynamic-report` + hook `useDynamicReports.preview`.
3. Página + wizard + preview funcionando (sem envio).
4. Edge function `run-dynamic-report` com geração de PDF e entrega pelo sino.
5. Entrega por WhatsApp.
6. Agendamento (`schedule_config` + cron + `schedule-dynamic-reports-tick`).
7. Histórico de execuções na UI.
