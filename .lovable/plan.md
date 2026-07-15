## Objetivo

Adicionar envio em massa de e-mails a partir dos contatos (capturados via QR codes), com fila, histórico, templates de e-mail e gatilhos automáticos no funil.

## Escopo funcional

### 1. Templates de e-mail
- Nova página `/email/templates` (ou aba dentro de `/email`) para CRUD de templates.
- Campos: nome, assunto, corpo HTML (editor rich text simples), variáveis (`{{nome}}`, `{{email}}`, `{{empresa}}`, campos customizados do contato).
- Preview com substituição de variáveis.

### 2. Envio em massa
- Nova tela "Campanha de E-mail" em `/email/campaigns`.
- Seleção de origem dos destinatários:
  - Broadcast list existente
  - Contatos por filtro (tags, funil, etapa, campo customizado)
  - Contatos capturados por formulário/QR code específico
- Escolha do canal (email_channel Gmail conectado) + template + variáveis.
- Configuração de ritmo: quantidade por lote, intervalo entre lotes, janela de horário.
- Ao disparar: cria linhas em `email_campaign_recipients` com status `pending`, agendadas conforme ritmo.

### 3. Fila e processamento
- Tabela `email_campaigns` (config da campanha) e `email_campaign_recipients` (1 linha por destinatário).
- Edge function `email-campaign-dispatch` chamada por pg_cron a cada minuto: pega recipients `pending` com `scheduled_at <= now()`, respeita limite por chamada, envia via `email-send` reaproveitando `ensureFreshGmailToken` + `buildRawMime`, marca `sent`/`failed`, grava erro.
- Retry automático em falha transitória (até 3 tentativas).

### 4. Histórico
- Tela da campanha mostra: totais (pendente/enviado/falhou), lista de destinatários com status, timestamp, erro.
- Tabela `email_send_log` (por campanha) para auditoria agregada.

### 5. Gatilhos no funil
- Estender `funnel_automations` para suportar `action_type = 'send_email'`.
- Config da automação: template de e-mail, canal, destinatário (email do contato do deal).
- Ao mover deal para etapa X (`on_stage_enter`), engine dispara e-mail imediatamente via `email-send`, registrando no histórico.
- UI: no editor de automação do funil, adicionar "Enviar e-mail" como ação, com seletor de template + canal.

## Detalhes técnicos

### Novas tabelas
```
email_templates_v2 (id, organization_id, user_id, name, subject, body_html, variables jsonb, created_at, updated_at)
email_campaigns (id, organization_id, user_id, name, channel_id, template_id, source_type, source_config jsonb,
                 batch_size int, batch_interval_seconds int, send_window jsonb,
                 status ['draft','running','paused','completed','failed'],
                 stats jsonb, started_at, completed_at, created_at, updated_at)
email_campaign_recipients (id, campaign_id, contact_id, email, variables jsonb,
                           status ['pending','sending','sent','failed','skipped'],
                           scheduled_at, sent_at, error_message, message_id, thread_id,
                           attempts int default 0, created_at, updated_at)
```
Todas com RLS por `organization_id` via `get_organization_member_ids`, GRANT para authenticated/service_role.

Reaproveitar `email_templates` existente se schema for compatível; senão criar `email_templates_v2` limpo.

### Edge functions
- `email-campaign-create` — cria campanha + expande recipients + agenda.
- `email-campaign-dispatch` — chamada por pg_cron; processa lote respeitando ritmo, envia via lógica de `email-send`. Marca campanha `completed` quando não há mais `pending`.
- `email-campaign-control` — pausar/retomar/cancelar.
- Extensão do engine de automações do funil (`funnel-automation-runner` ou equivalente) para suportar `send_email`.

### pg_cron
Job `email-campaign-tick` a cada 1 minuto chamando `email-campaign-dispatch`.

### Frontend
- `src/pages/EmailCampaigns.tsx` (lista + criação)
- `src/pages/EmailCampaignDetail.tsx` (progresso + histórico)
- `src/pages/EmailTemplates.tsx` (CRUD templates)
- `src/components/email/CampaignWizard.tsx` (passos: destinatários → template → ritmo → revisar)
- Hooks: `useEmailTemplates`, `useEmailCampaigns`, `useEmailCampaignRecipients`
- Adicionar ação "Enviar e-mail" no editor de automações do funil (`src/components/funnels/automations/...`).

### Segurança / RLS
- Todas as tabelas com RLS por organização.
- Envio só permite `channel_id` cuja `organization_id` bate com a do usuário.
- Validação server-side de e-mails (formato) e deduplicação por (campaign_id, email).

## Fora de escopo (para depois)
- Editor drag-and-drop visual.
- A/B testing.
- Tracking de abertura/clique (requer pixel + link redirect).
- SMTP genérico além de Gmail conectado.
