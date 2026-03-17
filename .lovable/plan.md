

## Problema Identificado

As políticas de segurança (RLS) nas tabelas `ai_knowledge_suggestions` e `ai_agent_knowledge_items` estão configuradas como `auth.uid() = user_id`, ou seja, restringem acesso apenas ao **usuário exato** cujo ID está na coluna `user_id`.

A Edge Function `analyze-agent-learning` grava as sugestões com `user_id = agentConfig.user_id` (o dono do agente). Se o usuário logado não for o dono do agente:
1. **Não consegue VER** as sugestões (SELECT bloqueado pelo RLS)
2. **Não consegue ATUALIZAR** as sugestões ao aprovar/ignorar (UPDATE bloqueado)

Mesmo que o usuário seja o dono, o `update` na tabela `ai_knowledge_suggestions` pode falhar silenciosamente se houver discrepância de IDs.

## Solução

### 1. Atualizar RLS de `ai_knowledge_suggestions` para org-wide
- Trocar `auth.uid() = user_id` por verificação via `get_organization_member_ids`
- SELECT, UPDATE, DELETE: permitir para membros da mesma organização
- INSERT: manter `auth.uid() = user_id` ou org-wide

### 2. Atualizar RLS de `ai_agent_knowledge_items` para org-wide
- Mesma lógica: permitir que membros da organização vejam e criem itens de conhecimento

### 3. Corrigir o hook `useAgentLearningSuggestions`
- No `approveSuggestion`, a query de SELECT filtra por `agent_config_id` mas o RLS bloqueia. Com o RLS corrigido, isso resolve automaticamente.

### Alterações
- **Migração SQL**: Dropar e recriar as policies das duas tabelas usando `user_id IN (SELECT get_organization_member_ids(auth.uid()))`
- **Sem alterações no frontend** — o código já está correto, só o RLS está bloqueando

