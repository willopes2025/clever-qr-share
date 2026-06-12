
## Objetivo

Hoje o PDF entregue ao empresário é quase 100% qualitativo (notas de IA + resumo). Falta o "raio-X" do uso do sistema: volume de mensagens, leads, conversões, equipe e campanhas. A proposta é transformar o relatório em um **painel executivo completo do período** — algo que o dono leia em 2 minutos e entenda saúde do negócio, produtividade da equipe e oportunidades.

---

## Novas seções propostas para o PDF

### 1. Capa executiva (1 página)
- **Cards de destaque** (verde/vermelho com seta de variação vs. período anterior):
  - Leads novos recebidos
  - Conversas atendidas
  - Mensagens enviadas / recebidas
  - Negócios ganhos (qtd e R$)
  - Taxa de conversão
  - Tempo médio de 1ª resposta
- **Highlights**: 3 frases automáticas, ex. "Atendentes responderam 18% mais rápido", "Funil Vendas teve queda de 12% na conversão", "Campanha X teve melhor desempenho do mês".

### 2. Volume e atividade
- Mensagens enviadas vs. recebidas (com gráfico por dia)
- Distribuição por canal (Evolution vs. Meta)
- Pico de horário de atendimento (gráfico de barras por hora)
- Áudios enviados/recebidos e taxa de transcrição
- Mídias enviadas (imagens, documentos, vídeos)

### 3. Leads e contatos
- Leads novos no período (+ % vs. anterior)
- Origem dos leads (campanha, formulário, importação, manual)
- Leads sem resposta (gargalo de atendimento)
- Contatos reativados (sem contato há > 30 dias que voltaram)

### 4. Funil comercial
- Pipeline total (R$ e qtd) por funil
- Conversão por etapa (com identificação de gargalo)
- Tempo médio em cada etapa
- Ganhos / Perdidos (motivos de perda agregados)
- Ticket médio e ciclo de vendas em dias

### 5. Produtividade da equipe
- Tabela rankeada por atendente: mensagens enviadas, conversas atendidas, leads ganhos, R$ vendido, tempo médio de resposta, tarefas concluídas/atrasadas
- Tempo logado, em pausa e em almoço (de `user_activity_sessions`)
- Quem mais converteu / quem mais demorou para responder

### 6. SLA e qualidade de atendimento
- Tempo médio de 1ª resposta + cumprimento de SLA (já existe parcialmente)
- Conversas não respondidas (fila pendente)
- Tarefas vencidas por responsável
- Conversas com handoff pedido para humano

### 7. Campanhas e disparo em massa
- Total disparado, entregue, falhado por campanha
- Taxa de leitura e resposta
- Comparativo entre templates
- Melhor horário identificado de engajamento

### 8. IA e automação
- Mensagens respondidas pela IA vs. humano
- Conversas resolvidas sem intervenção
- Tokens consumidos no período (custo IA)
- Automações disparadas (gatilhos de funil, agendamentos)

### 9. Insights inteligentes (mantém o atual, refinado)
- Resumo executivo (3 parágrafos)
- 3 pontos fortes do mês
- 3 alertas/áreas a melhorar
- 3 recomendações acionáveis

### 10. Comparativo período anterior
- Mini-tabela com cada KPI: período atual / período anterior / variação %

---

## Dados que já existem e podem ser usados

A maior parte já está no banco — não precisa coletar nada novo:

- `inbox_messages` → volume, canal, tipo, horários
- `contacts` + `funnel_deals` → leads, pipeline, conversões
- `funnels` / `funnel_stages` / `funnel_deal_history` → gargalos, tempo por etapa
- `user_activity_sessions` → tempo logado / pausa / almoço
- `deal_tasks` / `conversation_tasks` → tarefas concluídas/atrasadas
- `campaigns` / `campaign_messages` → desempenho de campanhas
- `sla_metrics` → SLA e 1ª resposta
- `ai_token_transactions` → custo de IA
- `chatbot_executions` → respostas automatizadas
- Hook `useDashboardMetricsV2` (RPC `get_overview_metrics`) já agrega vários desses números

---

## Detalhes técnicos (para depois)

- Expandir `analyze-conversations` para também buscar e agregar todas as métricas acima (rodar em paralelo com o que já roda).
- Persistir esses agregados em novas colunas/`jsonb` em `conversation_analysis_reports` (`usage_metrics`, `team_productivity`, `funnel_metrics`, `campaign_metrics`, `period_comparison`).
- Reescrever `buildPdf` em `send-scheduled-analysis/index.ts` para incluir as novas seções, com mini-gráficos desenhados via `jsPDF` (barras simples) ou tabelas formatadas.
- Adicionar query do período anterior (mesma duração imediatamente antes) para calcular variação %.
- O front (`AnalysisReportDetail.tsx`) também ganha as novas seções para visualizar no app.

---

## Sugestão de priorização (caso queira fazer em etapas)

1. **Fase 1 — KPIs e capa executiva** (alto impacto, baixo esforço): seções 1, 2, 3, 10.
2. **Fase 2 — Comercial**: seções 4, 5.
3. **Fase 3 — Qualidade e IA**: seções 6, 7, 8.

Posso começar pela **Fase 1** já entregando um PDF muito mais "de empresário" — ou implementar tudo de uma vez. Me diga qual caminho prefere.
