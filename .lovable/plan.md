# Correção: Acesso de agentes de IA por organização (com permissões)

## Objetivo
Permitir que membros da organização com **permissão concedida** visualizem/gerenciem os agentes de IA criados por outros membros. Membros sem permissão continuam sem acesso, exatamente como hoje.

## Modelo de permissões (já existente em `src/config/permissions.ts`)
- `view_ai_agents` → listar, abrir e visualizar agentes da organização
- `create_ai_agents` → criar novos agentes
- `manage_ai_agents` → editar, apagar, gerenciar knowledge/variables/stages/media

O owner da organização e o role `admin` recebem essas permissões por padrão; membros comuns só têm se o owner conceder explicitamente em Configurações → Equipe.

## Causa raiz (confirmada)
Policies RLS já autorizam acesso por organização via `get_organization_member_ids`. O frontend anula esse compartilhamento adicionando `.eq('user_id', auth.uid())` em todas as queries de agentes.

## Mudanças

### 1. Novo hook `src/hooks/useOrganizationMemberIds.ts`
- Chama a RPC `get_organization_member_ids(auth.uid())` via React Query, cache alto.
- Retorna `string[]` para uso em filtros `.in('user_id', ids)`.

### 2. `src/hooks/useAIAgentConfig.ts`
- Substituir `.eq('user_id', user.id)` por `.in('user_id', orgMemberIds)` nas leituras:
  - `useAllAgentConfigs`, `useAgentConfigByCampaign`
  - Queries de `ai_agent_knowledge_items`, `ai_agent_variables`, `ai_agent_stages`, `ai_agent_media_library`, `ai_agent_stage_media`
- Nos hooks de UPDATE/DELETE: remover `.eq('user_id', user.id)` — RLS já valida organização.
- INSERTs continuam gravando `user_id = auth.uid()` (dono/criador).
- Query fica `enabled: !!orgMemberIds?.length` para evitar flash vazio.

### 3. `src/components/shared/AgentPicker.tsx`
- Mesma troca para o dropdown listar agentes da organização inteira (respeitando permissão via gating na tela que o usa, quando aplicável).

### 4. Gating de UI por permissão (NÃO remove nada do que já existe; formaliza)
- `src/pages/AIAgents.tsx`: usar `useOrganization().hasPermission('view_ai_agents')` — se falso, mostrar estado "Sem permissão para visualizar agentes" em vez de lista vazia.
- Botão "Criar agente" só aparece com `create_ai_agents`.
- Botões editar/apagar/gerenciar (knowledge, variáveis, stages, mídia) só aparecem com `manage_ai_agents`.
- Owner e admin continuam com tudo por padrão.

### 5. Verificação de RLS antes de codar
- Rodar `supabase--read_query` conferindo as policies de `ai_agent_configs`, `ai_agent_knowledge_items`, `ai_agent_variables`, `ai_agent_stages`, `ai_agent_media_library`, `ai_agent_stage_media`.
- Se alguma policy de SELECT/UPDATE/DELETE ainda estiver restrita a `user_id = auth.uid()`, incluir migração para escopo organizacional (INSERT permanece restrito ao criador).

## Fora de escopo
- Não criar novas chaves de permissão (as três existentes cobrem o caso).
- Não mudar o "dono" (`user_id`) de agentes já criados.
- Sem alteração de comportamento para usuários que trabalham sozinhos.
