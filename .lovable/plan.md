## Objetivo

Transformar a página **Análise** em uma central de performance que avalia:
1. A equipe inteira (como já faz hoje)
2. **Cada usuário individualmente** com nota, ranking e coaching personalizado
3. **O funil** (gargalos, taxa de conversão por etapa, tempo médio, motivos de perda)
4. **Disparos de mensagem** (campanhas, templates, melhores horários, taxa de resposta)
5. **SLA / tarefas** (tempo de primeira resposta, atrasos)

A IA gera recomendações acionáveis em cada eixo.

---

## Mudanças

### 1. Banco de dados — expandir `conversation_analysis_reports`

Nova migration adicionando colunas JSONB (todas nullable para não quebrar relatórios antigos):

- `user_performance` — array por usuário: `{ user_id, name, overall_score, textual, communication, sales, efficiency, audio, messages_sent, messages_received, conversations_handled, avg_first_response_seconds, ranking, strengths[], improvements[], coaching_tips[] }`
- `funnel_performance` — `{ funnels: [{ funnel_id, name, won_rate, lost_rate, avg_days_to_close, bottleneck_stages: [{ stage_id, name, conversion_rate, avg_hours, lost_count }], suggestions: [] }] }`
- `campaign_performance` — `{ campaigns: [{ campaign_id, name, sent, delivered, replied, reply_rate, best_hours, template_performance: [{template_id, name, reply_rate, suggestions[]}], suggestions[] }] }`
- `sla_performance` — `{ avg_first_response_seconds, unanswered_count, overdue_tasks_count, by_user: [...] }`
- `analysis_scope` — `{ user_ids: [], funnel_ids: [], include_campaigns: bool, include_sla: bool }` (filtros usados)

### 2. Edge function `analyze-conversations` — coleta multi-fonte

Hoje só lê `inbox_messages`. Vamos cruzar:

- **Conversas/mensagens** (já existe) — agregar por `sent_by_user_id` para métricas individuais
- **`funnel_deals` + `funnel_deal_stage_history`** — tempo por etapa, won/lost, motivos
- **`campaigns` + `campaign_sends` + `message_templates`** — taxa entrega/resposta
- **`tasks`** — atrasos, conclusões
- **`get_member_message_productivity`** (RPC já existe) — produtividade pronta por usuário
- **`get_overview_metrics`** (RPC já existe) — SLA agregado

Reestruturar prompt da IA em **4 chamadas paralelas via tool-calling** (uma por eixo) para caber no contexto e dar análise profunda em cada um:
1. `analyze_team_and_conversations` (já existe — mantém)
2. `analyze_users` → retorna `user_performance[]` com coaching individual
3. `analyze_funnel` → retorna `funnel_performance` com sugestões de otimização
4. `analyze_campaigns` → retorna `campaign_performance` com sugestões de templates e horários

Modelo: **Lovable AI Gateway** com `google/gemini-2.5-pro` (contexto grande + reasoning) — substitui chamada direta à OpenAI atual, removendo dependência do `OPENAI_API_KEY` daqui.

Background: usar `EdgeRuntime.waitUntil` (já é o padrão).

### 3. Frontend — nova UI da Análise

**`src/pages/Analysis.tsx`** ganha filtros antes de gerar:
- Período (existe)
- Multi-select de usuários (default: todos da org)
- Multi-select de funis
- Toggle "Incluir campanhas" / "Incluir SLA"
- Toggle "Transcrever áudios" (existe)

**`AnalysisReportDetail.tsx`** ganha 4 abas novas além das atuais:
- **Por Usuário** — ranking com cards: nota geral, gráfico radial (5 dimensões), top 3 forças, top 3 melhorias, bloco "Coaching da IA" com exemplos reais de mensagens
- **Funil** — por funil: gargalos destacados, tempo médio por etapa, sugestões da IA
- **Campanhas & Templates** — taxa de resposta, melhores horários (heatmap simples), ranking de templates, sugestões
- **SLA** — primeira resposta média, leads sem resposta, tarefas atrasadas

**Nova página `/performance` (`PerformanceDashboard.tsx`)** — dashboard contínuo (não exige gerar relatório): consome RPCs existentes (`get_member_message_productivity`, `get_messages_by_hour`, `get_overview_metrics`, `get_funnel_metrics`) para mostrar ranking ao vivo + botão "Gerar análise profunda com IA deste período" que dispara o fluxo acima já com o filtro aplicado.

Adicionar rota no `App.tsx` e item no sidebar (logo abaixo de "Análise").

### 4. Export PDF

Atualizar `src/lib/pdf-export.ts` (`generateAnalysisPDF`) para incluir as novas seções (Por Usuário, Funil, Campanhas, SLA) quando presentes.

---

## Detalhes técnicos

- **Acesso/RLS**: edge function usa `get_organization_member_ids(auth.uid())` para limitar dados ao escopo da org (padrão já adotado no projeto).
- **Performance**: filtrar mensagens pelo período já no SQL; limitar a 200 conversas/30k mensagens por relatório para caber no contexto do Gemini.
- **Custos**: usar `gemini-2.5-flash` para análises por-usuário em lote (mais barato) e `gemini-2.5-pro` apenas para o resumo executivo + recomendações de funil/campanha.
- **Compatibilidade**: campos novos são opcionais — relatórios antigos continuam renderizando normalmente (abas extras não aparecem se vazias).
- **Sem novos secrets**: usa `LOVABLE_API_KEY` já existente.

---

## Entregáveis

```text
Migration  → adicionar 5 colunas JSONB em conversation_analysis_reports
Backend    → reescrever supabase/functions/analyze-conversations/index.ts
             (4 chamadas paralelas via Lovable AI + coleta multi-fonte)
Frontend   → Analysis.tsx (filtros)
             AnalysisReportDetail.tsx (4 abas novas)
             components/analysis/UserPerformanceCard.tsx (novo)
             components/analysis/FunnelInsightsTab.tsx (novo)
             components/analysis/CampaignInsightsTab.tsx (novo)
             components/analysis/SLAInsightsTab.tsx (novo)
             pages/PerformanceDashboard.tsx (nova rota /performance)
             hooks/usePerformanceDashboard.ts (novo)
             App.tsx + sidebar (rota + link)
PDF        → lib/pdf-export.ts (novas seções)
Hook       → useAnalysisReports.ts (tipagem dos novos campos)
```
