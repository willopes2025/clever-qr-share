# Equipe Digital de IA — evolução para multiagente

## O que já existe hoje (analisado)

- `ai_agent_configs` (32 colunas): identidade, prompt de personalidade, regras de comportamento, horários ativos, handoff por palavra-chave, criação de tarefas, voz. Vínculo por `funnel_id` ou `campaign_id`, dono por `user_id`.
- Tabelas satélite já no formato certo para reaproveitar: `ai_agent_knowledge_items` (conhecimento), `ai_agent_stages` + `ai_agent_stage_media` (etapas), `ai_agent_variables`, `ai_agent_integrations`, `ai_agent_media_library`, `ai_knowledge_suggestions`, `ai_token_transactions`.
- Runtime: `supabase/functions/ai-campaign-agent/index.ts` (~3000 linhas) já faz o ciclo completo: monta o prompt, injeta conhecimento, expõe ferramentas (`tools` + `tool_choice: auto`: agenda/Calendly, criar tarefa, mídia de etapa), executa as chamadas e envia a resposta pelo canal.
- Seleção de agente hoje: 1 agente ativo por campanha ou por funil (`.single()`), sem orquestração.
- UI: `src/pages/AIAgents.tsx` + `AIAgentFormDialog.tsx` (1120 linhas, formulário em abas), `AIAgentCard`, `AIAgentTestDialog`, seletor de templates.

Conclusão de viabilidade: a evolução é viável **sem reescrita**. O runtime atual vira o "Agent Runtime" e ganha uma camada de orquestração acima dele. A maior parte do trabalho é modelo de dados + registro de ferramentas + UI, não motor novo.

## Estratégia

Manter `ai_agent_configs` como a tabela de agentes (evoluir por colunas novas, não substituir), extrair o miolo do `ai-campaign-agent` para módulos compartilhados em `supabase/functions/_shared/agents/`, e criar um orquestrador fino que escolhe/encadeia agentes e grava logs de execução.

Fluxo alvo:

```text
Canal (WhatsApp/Meta/Evolution)
  -> Conversa (conversations / inbox_messages)
  -> Orquestrador (intenção + seleção de agente)
  -> Memória (conversa / cliente / empresa)
  -> Agent Runtime (prompt + conhecimento + ferramentas permitidas)
  -> Delegação a outro agente (limitada) ou transferência
  -> Resposta consolidada -> Canal
  -> Log de execução (auditoria)
```

## Modelo de dados proposto

Novas colunas em `ai_agent_configs`:
- `organization_id` (isolamento real por empresa, hoje só há `user_id`)
- `role_key` (sdr, vendas, suporte, financeiro, cobranca, pos_venda, especialista)
- `objective`, `not_allowed` (o que não deve fazer)
- `is_orchestrator` (boolean), `activation_rules` (jsonb: quando este agente deve atuar)
- `allowed_tools` (text[]), `max_delegations` (int), `max_tool_calls` (int)

Novas tabelas:
- `ai_agent_transfers` — origem, destino, condição/descrição, prioridade (regras de transferência = as "conexões" do organograma)
- `ai_agent_knowledge_links` — quais fontes de `ai_agent_knowledge_items` cada agente pode usar (hoje o conhecimento é preso a 1 agente)
- `ai_agent_memory` — escopo (`conversation` | `contact` | `organization`), chave, conteúdo, importância, expiração
- `ai_execution_runs` — 1 linha por mensagem processada: conversa, agente inicial, intenção, tempo, custo/tokens, erro, resposta final
- `ai_execution_steps` — passos do run: tipo (`intent`, `agent`, `knowledge`, `tool`, `delegation`, `transfer`, `compose`), agente, entrada/saída resumida, duração
- `ai_skills` + `ai_agent_skills` — competências reutilizáveis (instruções + ferramentas + campos), já criadas na fase 1 mas com catálogo interno apenas

Todas com RLS por organização usando `get_organization_member_ids` / `get_user_organization_id`, GRANTs para `authenticated` e `service_role`.

## Backend

Novos módulos compartilhados (`supabase/functions/_shared/agents/`):
- `tool-registry.ts` — catálogo único de ferramentas (consultar cliente, consultar CRM, consultar produto/estoque, criar oportunidade, atualizar lead, consultar financeiro, criar tarefa, executar automação, transferir atendimento, agendamento). Cada ferramenta declara schema, escopo e handler. **A permissão é validada no servidor** contra `allowed_tools` do agente antes de executar.
- `agent-runtime.ts` — monta prompt (identidade + objetivo + regras + conhecimento + memória), chama o modelo, executa ferramentas permitidas, respeita limites.
- `memory.ts` — leitura/escrita das 4 camadas, com seleção por relevância (fase 1: por recência + palavras-chave; fase 3: busca semântica).
- `orchestrator.ts` — classifica intenção, escolhe agente(s) por `role_key`/`activation_rules`, delega com teto de delegações/ferramentas/tempo, consolida resposta única.
- `run-logger.ts` — grava `ai_execution_runs`/`ai_execution_steps`.

Nova edge function `ai-orchestrate` como ponto de entrada. `ai-campaign-agent` passa a usar os módulos compartilhados e continua funcionando para campanhas (sem quebra).

## UI (linguagem simples, sem jargão)

- `src/pages/AIAgents.tsx`: alternância entre "Cards" e "Equipe" (organograma em cards com linhas de transferência, sem drag-and-drop na v1).
- `AIAgentFormDialog.tsx`: abas passam a ser **Identidade · Objetivo · Instruções · Conhecimento · Ferramentas · Memória · Pode transferir para · Quando atuar**.
- Novo `src/components/ai-agents/AgentToolsTab.tsx` (checkboxes com nomes de negócio), `AgentTransfersTab.tsx`, `AgentKnowledgeTab.tsx` (seleção multi-agente), `AgentTeamGraph.tsx`.
- Novo `src/components/ai-agents/ExecutionTimeline.tsx` + aba de histórico: linha do tempo "Mensagem → Orquestrador → Comercial → Consulta de produto → Resposta".

## Fases

**Fase 1 — MVP (o que entra primeiro)**
1. Migração: colunas novas em `ai_agent_configs`, `ai_agent_transfers`, `ai_agent_knowledge_links`, `ai_agent_memory`, `ai_execution_runs/steps` + RLS/GRANTs.
2. `tool-registry.ts` com permissões validadas no backend e as ferramentas que já existem hoje (tarefa, agenda, mídia) + consultar cliente/CRM/lead.
3. Extração do runtime atual para `agent-runtime.ts`, sem mudança de comportamento.
4. Orquestrador simples: intenção → 1 agente → resposta; transferência por regra; sem multiagente paralelo.
5. UI: múltiplos agentes por empresa, função/objetivo, ferramentas, conhecimento compartilhado, regras de transferência, marcação de orquestrador.
6. Logs de execução + linha do tempo.

**Fase 2** — delegação real entre agentes (com tetos), consolidação de múltiplas intenções em uma resposta, memória do cliente/empresa alimentada automaticamente.

**Fase 3** — busca semântica no conhecimento, organograma editável por conexões visuais, painel de custo por agente.

**Fase 4** — biblioteca de Competências (Skills) instaláveis.

## Riscos e cuidados

- `ai-campaign-agent` é grande e crítico: a extração será feita preservando o comportamento atual e mantendo o caminho de campanhas intacto.
- Agentes hoje usam `user_id`; o backfill de `organization_id` usa `resolve_user_organization_id` e precisa ser conferido antes de as RLS novas entrarem.
- Limites de delegação/custo entram já na fase 1 para não permitir laço infinito quando a fase 2 ligar a delegação.

## Nesta primeira entrega

Se aprovado, começo pela migração da fase 1 e pelo registro de ferramentas, depois a UI do Agent Builder e por fim o orquestrador + logs.
