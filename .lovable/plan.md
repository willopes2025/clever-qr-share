
## Diagnóstico do PDF atual

O PDF que você enviou (`analise-2026-06-17-...pdf`) tem só 3 páginas porque **a maior parte dele caiu em fallback vazio**:

- Notas da IA: **0/0/0/0/0/0** → a chamada `analyze_conversations` falhou ou voltou sem dados → entrou no fallback `executive_summary = "Análise concluída."` e zerou `strengths` / `improvements` / `recommendations` / `conversation_details`.
- O builder (`supabase/functions/send-scheduled-analysis/index.ts`) já tem as seções **Resumo Executivo, Recomendações, Pontos Fortes, Áreas de Melhoria, Detalhes por Conversa** — mas elas só renderizam se vierem populadas. Como vieram vazias, o PDF terminou no "Análise concluída".
- Seções **Funis** (`analyze_funnel`) e **Análise individual por atendente** (`analyze_users`) **nunca são desenhadas no PDF**, mesmo quando a IA retorna dados — só aparecem na UI (`AnalysisReportDetail`, `FunnelInsightsTab`, `UserPerformanceTab`).
- KPIs são apresentados como números soltos: não há **leitura/narrativa** explicando o que cada bloco significa (ex.: "leads caíram 40% — concentração de queda na quarta às 14h", "Gleycy ficou 41h logada mas só atendeu 1 conversa", etc.).
- Não há **prioridade** nas recomendações nem **plano de ação**.

## O que vai mudar

### 1. Robustez da IA (resolver o "tudo zero")
Em `supabase/functions/analyze-conversations/index.ts`:
- Adicionar **retry** (1 reintento) em cada uma das 4 chamadas paralelas quando vier `null` / `tool_args` vazio.
- Quando o período tiver pouco volume (ex.: < 20 conversas), encurtar o `conversationTexts` e simplificar o schema para reduzir falha de tool calling.
- Em vez do fallback "Análise concluída.", gerar um **resumo determinístico** a partir dos KPIs (variação x período anterior, top atendente, principal gargalo de SLA) — assim o PDF nunca mais vai sair "vazio".
- Logar no `error_message` o motivo real (timeout/tool error) para diagnóstico futuro.

### 2. Novo prompt: "comentário narrativo por seção"
Adicionar uma 5ª chamada à IA (`narrate_sections`, também `google/gemini-2.5-flash`, tool calling estruturado) que recebe **todos os agregados** (KPIs + volume + leads + comercial + equipe + SLA + IA + campanhas + comparativo) e devolve um objeto:

```
{
  executive_kpis_commentary: string,     // 3–5 frases sobre os KPIs do topo
  volume_commentary: string,              // padrões de horário/dia + alertas
  leads_commentary: string,               // origens, tempo de espera, riscos
  commercial_commentary: string,          // pipeline, conversão, ticket
  team_commentary: string,                // ranking + outliers (ex.: muita hora pouca msg)
  team_per_user: [{ user_id, note }],     // 1 linha por atendente
  sla_commentary: string,                 // diagnóstico das quebras
  ai_commentary: string,                  // eficácia da IA + handoff
  campaigns_commentary: string,           // o que está performando e o que não
  funnel_commentary: string,              // gargalos por etapa
  action_plan: [                          // até 5 ações priorizadas
    { priority: 'alta'|'media'|'baixa', title, why, how, owner_hint }
  ]
}
```

Esse texto é salvo em `conversation_analysis_reports.usage_metrics.ai_narrative` (sem mudar schema — é JSONB livre).

### 3. PDF muito mais rico (`buildPdf` em `send-scheduled-analysis/index.ts`)

Em cada seção existente, adicionar um **callout "Leitura da IA"** logo abaixo dos números — caixa cinza-clara de 4–8 linhas usando o respectivo `*_commentary`.

Seções novas / expandidas:

| Seção | Hoje | Depois |
|---|---|---|
| Capa / KPIs | só cards | + callout "Leitura da IA" + comparativo destacando a maior queda/alta |
| Volume e Atividade | bars de dia/hora | + comentário (ex.: "70% dos envios entre 10h–15h; sexta cai 35%") |
| Leads e Contatos | totais + origens | + comentário sobre origens com pior tempo de resposta |
| Comercial | totais | + comentário + **mini-funil visual** (Pipeline → Ganhos / Perdidos) |
| Produtividade da Equipe | tabela | + para cada atendente: 1 linha de coach (`team_per_user.note`) e badges de outlier (ex.: "muito tempo logado / poucas msgs") |
| SLA | barras de quebra | + comentário de diagnóstico e 1–2 ações |
| IA e Automação | barras IA vs humano | + comentário sobre efetividade e onde houve handoff |
| **Funis (NOVA)** | não existe no PDF | tabela por funil: deals, win-rate, dias p/ fechar + **top 3 etapas-gargalo** com nota da IA |
| Campanhas | tabela | + por campanha: 1 linha de recomendação (`analyze_campaigns` já existe, só não é renderizado) |
| Pontos Fortes / Áreas de Melhoria | bullets | mantém, mas com **fallback** quando vazio (usar `team_commentary` / `sla_commentary`) |
| **Plano de Ação (NOVO)** | não existe | última seção: até 5 ações priorizadas (alta/média/baixa) com **por que, como, dono sugerido** |
| Detalhes por Conversa | só se IA preencher | adicionar amostra mínima das 5 conversas com pior tempo de 1ª resposta como fallback |

Cosméticos:
- Cabeçalho de seção mantém o estilo azul atual.
- Callout da IA: fundo `#F1F5F9`, borda lateral azul de 2px, fonte 9pt itálico, prefixo "Leitura da IA —".
- Plano de ação: cards numerados, bolinha colorida por prioridade.

### 4. Mesmo PDF na UI
`src/lib/pdf-export.ts` (botão **Download** da página `Analysis`) hoje é uma versão **mais simples** que a do scheduled. Vou unificar: extrair `buildPdf` para um módulo compartilhado client-side (ex.: `src/lib/pdf-analysis.ts`) que o `Analysis.tsx` passa a usar — o PDF exportado manualmente fica igual ao enviado por WhatsApp agendado.

## Arquivos afetados

- `supabase/functions/analyze-conversations/index.ts` — retry, fallback determinístico, nova chamada `narrate_sections`, salva `ai_narrative` em `usage_metrics`.
- `supabase/functions/send-scheduled-analysis/index.ts` — `buildPdf` ganha callouts, seções de Funis, Campanhas detalhadas, Plano de Ação e per-user coach.
- `src/lib/pdf-analysis.ts` (novo) — versão client-side do mesmo builder.
- `src/lib/pdf-export.ts` — passa a delegar para `pdf-analysis.ts`.
- `src/hooks/useAnalysisReports.ts` — expor o campo `ai_narrative` no tipo (sem migration).

## O que **não** vai mudar

- Nenhuma alteração de schema do banco (`ai_narrative` mora em `usage_metrics` JSONB que já existe).
- Modelos (continua `google/gemini-2.5-flash` via Lovable AI Gateway).
- Fluxo da UI da página Análise (botões, switches, agendamento).

## Observação
Posso, opcionalmente, **rodar 1 backfill** que pega o último relatório vazio e regera só a narrativa (sem re-chamar tudo) — me confirme se quer.
