## Objetivo

Todo dia, no horário definido (padrão 8h no fuso da organização), o sistema analisa as conversas/negócios dos últimos N dias e gera um PDF com:

- **Lista de leads quentes por etapa do funil**, agrupados por "Objetivo" (configurável).
- **Resumo da última conversa de cada lead** (bullet points + sinais de compra detectados pela IA).

O **gestor** recebe o consolidado por **e-mail** (PDF anexado/link). Cada **vendedor** recebe via **WhatsApp** apenas seus próprios leads (PDF como documento na instância conectada).

---

## Conceito: "Objetivo de Compra"

Nova entidade configurável por funil. Cada objetivo = um agrupamento de etapas + um prompt próprio que define o que é "comprador potencial" para aquele contexto.

Exemplos:
- **Comprador VIP** → etapas: Proposta, Negociação → prompt: "Identifique leads com ticket alto, urgência e sinais de decisão..."
- **Recompra** → etapas: Pós-venda → prompt: "Identifique clientes satisfeitos prontos para nova compra..."
- **Upsell** → etapas: Ativos → prompt: "Identifique clientes que demonstraram interesse em produtos premium..."

Cada objetivo tem: nome, descrição, funil, etapas incluídas, prompt da IA, score mínimo (0-100), nº máx de leads no relatório, ativo/inativo.

---

## Telas (Frontend)

### 1. Configuração — em `Analysis` (nova aba "Relatórios Diários")
- Lista de objetivos cadastrados (cards) + botão "Novo Objetivo".
- Form: nome, funil, multiselect de etapas, textarea do prompt (com chips de variáveis: `{contato}`, `{ultimas_mensagens}`, `{tempo_etapa}`, `{valor_negocio}`, `{custom_fields}`), slider de score mínimo, limite de leads.
- Seção "Destinatários":
  - **Gestores (e-mail)**: multiselect de membros da org → consolidado.
  - **Vendedores (WhatsApp)**: toggle "enviar para cada responsável" + escolha da instância de envio.
- Seção "Agendamento": hora local (default 08:00), dias da semana, janela de análise (últimos X dias, default 7).
- Botão "Gerar prévia agora" (roda on-demand e mostra/baixa o PDF).

### 2. Histórico
- Tabela com cada execução: data, objetivo, nº de leads encontrados, status email/WhatsApp, link p/ baixar PDF.

---

## Backend

### Novas tabelas
- `buyer_report_objectives` — id, organization_id, funnel_id, name, description, prompt, stage_ids (uuid[]), min_score, max_leads, lookback_days, schedule_time, schedule_days (int[]), enabled, manager_user_ids (uuid[]), send_to_assignee_whatsapp (bool), whatsapp_instance_id, created_at, updated_at.
- `buyer_report_runs` — id, objective_id, organization_id, executed_at, leads_count, pdf_storage_path, email_status, whatsapp_status, payload (jsonb com resultado da IA), error.
- Bucket de storage **`buyer-reports`** (privado) para arquivar PDFs com URL assinada.

RLS: ambos por `organization_id` via `get_organization_member_ids`. GRANT padrão para `authenticated` + `service_role`.

### Edge functions
1. **`generate-buyer-report`** (core)
   - Recebe `objective_id`.
   - Busca negócios das etapas do objetivo nos últimos `lookback_days`.
   - Para cada deal: pega últimas ~30 mensagens da conversa vinculada, dados do contato, valor, tempo na etapa, custom_fields.
   - Chama IA (`google/gemini-2.5-flash` via Lovable AI Gateway) **em lotes de 10 leads** com tool calling estruturado retornando `{ score, why_hot, last_conversation_summary[], buying_signals[], suggested_next_step }`.
   - Filtra por `min_score` e ordena desc; corta em `max_leads`.
   - Agrupa por etapa.
   - Gera PDF (jsPDF, mesmo padrão do `pdf-analysis.ts` existente) com: capa (objetivo, período, total), índice por etapa, card por lead (nome, telefone, valor, score com barra colorida, "Por que é quente", "Resumo da última conversa", "Sinais de compra", "Próxima ação sugerida").
   - Salva PDF no bucket, registra `buyer_report_runs`.
   - Retorna URL assinada.

2. **`dispatch-buyer-reports`** (scheduler)
   - Chamada por `pg_cron` a cada hora.
   - Para cada `buyer_report_objectives` enabled cuja hora local (convertida pelo `resolveOrgTimezone`) bate com agora e o dia está incluído: chama `generate-buyer-report`.
   - Para cada gestor em `manager_user_ids`: dispara `send-transactional-email` com template `buyer-report-daily` (PDF como link de download assinado válido por 7 dias).
   - Se `send_to_assignee_whatsapp`: agrupa leads por `assigned_to`/`owner`, gera **um PDF filtrado por vendedor** (reaproveita o motor), e envia via instância WhatsApp escolhida como documento.

3. Botão "Gerar prévia agora" chama `generate-buyer-report` direto e baixa o PDF.

### Template de email
- `supabase/functions/_shared/transactional-email-templates/buyer-report-daily.tsx` — assunto "Leads quentes de hoje — {objetivo}", corpo com nº de leads, top 3 destaques e botão "Baixar PDF completo".

### Cron
- `pg_cron` rodando `dispatch-buyer-reports` a cada hora (a função decide quais objetivos disparar pelo timezone da org).

---

## Detalhes técnicos

- **IA**: `google/gemini-2.5-flash`, `tool_choice` forçado, schema validado, retry 1x quando vier vazio (padrão já usado em `analyze-conversations`).
- **Prompt do objetivo** é injetado como `system`; o `user` recebe os dados estruturados de cada batch.
- **Timezone**: sempre via `resolveOrgTimezone()` no edge e `getActiveTimezone()` no frontend.
- **WhatsApp**: usa a instância selecionada; envio como documento `.pdf` respeitando a configuração de batch/delay já existente.
- **Permissões**: só admin/owner da org cria/edita objetivos; vendedor comum vê apenas o histórico de relatórios em que aparece.
- **Custo**: limite duro `max_leads` (default 50) + janela `lookback_days` (default 7) evitam estouro de tokens.

---

## Entregáveis

1. Migration: tabelas + RLS + GRANTs + bucket privado.
2. Edge functions: `generate-buyer-report`, `dispatch-buyer-reports`.
3. Template de e-mail `buyer-report-daily`.
4. Cron horário em `pg_cron`.
5. UI: nova aba "Relatórios Diários" em `Analysis` com CRUD de objetivos, prévia e histórico.
6. Hook `useBuyerReports.ts` para CRUD + trigger de prévia.

Pré-requisitos: infra de e-mail Lovable Cloud ativa (vou configurar domínio se ainda não estiver pronto antes de scaffoldar o template).
