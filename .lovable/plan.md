

## Problema

A função `analyze-agent-learning` tem **duas limitações** que impedem a extração de dados:

1. **Filtra apenas conversas com `ai_handled: true`** (linha 87) — conversas humanas como a da "Aline Galacha" são ignoradas
2. **Filtra apenas pelo `user_id` do agente** (linha 86) — não busca conversas de outros membros da organização
3. **Não existe UI** para disparar a análise — o hook `useAgentLearningSuggestions` existe mas nenhum componente o utiliza

## Solução

### 1. Corrigir a Edge Function `analyze-agent-learning`
- Remover o filtro `ai_handled: true` para incluir todas as conversas (humanas e IA)
- Substituir `.eq("user_id", ...)` por busca org-wide usando `get_organization_member_ids`
- Permitir receber um parâmetro opcional `conversationId` para analisar uma conversa específica (útil quando o usuário quer extrair dados de um contato específico)
- Expandir o range de datas padrão (últimos 7 dias ao invés de apenas ontem)

### 2. Adicionar aba "Aprendizado" no AIAgentFormDialog
- Adicionar uma 8ª aba chamada "Aprendizado" (ícone `GraduationCap`) no formulário do agente
- A aba mostrará:
  - Botão "Analisar Conversas" para disparar a análise
  - Seletor de período (ontem, últimos 7 dias, últimos 30 dias)
  - Lista de sugestões pendentes com opções de aprovar/rejeitar
  - Ao aprovar, o item é adicionado à base de conhecimento

### 3. Criar componente `AgentLearningTab.tsx`
- Novo componente em `src/components/campaigns/agent/AgentLearningTab.tsx`
- Usa os hooks `useAgentLearningSuggestions` e `useLearningSuggestionMutations` já existentes
- Mostra sugestões com pergunta, resposta, categoria e score de confiança
- Botões para aprovar (editar antes se quiser) e rejeitar cada sugestão

### Arquivos alterados
- `supabase/functions/analyze-agent-learning/index.ts` — remover filtro `ai_handled`, busca org-wide, parâmetro de período
- `src/components/campaigns/agent/AgentLearningTab.tsx` — novo componente
- `src/components/ai-agents/AIAgentFormDialog.tsx` — adicionar aba "Aprendizado"

