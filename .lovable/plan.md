

# Oportunidades: Dados editáveis + Navegação para conversa

## O que será feito

### 1. Persistir oportunidades no banco de dados
Atualmente os resultados da análise vivem apenas em memória (state + cache ref). Para permitir que o usuário anexe dados, precisamos de uma tabela `funnel_opportunities`.

**Nova tabela `funnel_opportunities`:**
- `id` (uuid, PK)
- `funnel_id` (uuid, FK funnels)
- `deal_id` (uuid, FK funnel_deals)
- `contact_id` (uuid, FK contacts)
- `conversation_id` (uuid, nullable)
- `contact_name`, `contact_phone`, `contact_email` (text)
- `stage_name` (text)
- `value` (numeric)
- `score` (integer)
- `insight` (text)
- `user_notes` (text, nullable) — campo editável pelo usuário
- `status` (text, default 'open') — para marcar como 'contacted', 'won', 'lost', etc.
- `user_id` (uuid, FK auth.users)
- `created_at`, `updated_at` (timestamptz)

RLS: `user_id IN (SELECT get_organization_member_ids(auth.uid()))` para SELECT/UPDATE/DELETE, `auth.uid() = user_id` para INSERT.

### 2. Edge Function atualizada
A função `analyze-funnel-opportunities` passará a salvar os resultados na tabela `funnel_opportunities` (usando service role para inserção), fazendo upsert por `deal_id + funnel_id`. Também retornará `contact_id` e `conversation_id` nos resultados.

### 3. Componente FunnelOpportunitiesView atualizado

**Coluna ID do contato:** Adicionar coluna com `ContactIdBadge` + `contact_display_id`. Para isso, a Edge Function também retornará `contact_display_id`.

**Nome clicável:** O nome do contato será um link que abre a conversa no Inbox em nova aba (`window.open(/inbox?conversationId=xxx, '_blank')`). Se não houver `conversation_id`, abre com `contactId`.

**Dados editáveis por linha:**
- Campo `user_notes` (textarea inline ou via dialog) para o usuário anotar informações sobre a oportunidade
- Campo `status` (select: Aberto, Contactado, Ganho, Perdido) para classificar
- Salvar alterações via `supabase.from('funnel_opportunities').update(...)` direto no frontend

**Carregar dados persistidos:** Ao abrir a aba, primeiro carrega oportunidades já salvas da tabela. Botão "Analisar" faz nova análise e sobrescreve scores/insights mas preserva `user_notes` e `status`.

### 4. Arquivos a criar/editar

| Arquivo | Ação |
|---------|------|
| Migration SQL | Criar tabela `funnel_opportunities` + RLS |
| `supabase/functions/analyze-funnel-opportunities/index.ts` | Retornar `contact_id`, `conversation_id`, `contact_display_id`; persistir resultados |
| `src/components/funnels/FunnelOpportunitiesView.tsx` | Adicionar colunas ID e nome clicável, campos editáveis, carregar do banco |

