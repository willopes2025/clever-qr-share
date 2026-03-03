

# Diagnóstico: Bot retorno não aparece para outros usuários

## Causa Raiz Identificada

As **políticas de segurança (RLS)** das tabelas de chatbot estão restritivas demais — usam `user_id = auth.uid()` em vez de `get_organization_member_ids()`. Isso impede membros da mesma organização de ver/usar os fluxos e suas execuções.

### Tabelas afetadas

| Tabela | Política atual | Problema |
|--------|---------------|----------|
| `chatbot_flows` | `user_id = auth.uid()` | Outros membros não veem os fluxos no menu `/` |
| `chatbot_flow_nodes` | `user_id = auth.uid()` | Nós do fluxo invisíveis para outros membros |
| `chatbot_flow_edges` | `user_id = auth.uid()` | Conexões do fluxo invisíveis para outros membros |
| `chatbot_executions` | `user_id = auth.uid()` | Execuções do bot invisíveis para outros membros |

**Nota:** As mensagens em si (`inbox_messages`) e conversas (`conversations`) já usam `get_organization_member_ids` e estão corretas. O problema é que os fluxos e execuções ficam invisíveis, impedindo que outros membros disparem fluxos pelo `/` e vejam o status das execuções.

## Solução

### 1. Atualizar RLS das 4 tabelas de chatbot

Substituir as políticas SELECT (e ALL no caso de `chatbot_executions`) para usar `get_organization_member_ids(auth.uid())`, seguindo o mesmo padrão já usado em `conversations` e `inbox_messages`:

**Para cada tabela:**
- DROP da política SELECT atual
- CREATE nova política SELECT usando `user_id IN (SELECT get_organization_member_ids(auth.uid()))`
- Para `chatbot_executions`: substituir a política ALL por políticas separadas (SELECT com org, INSERT/UPDATE/DELETE com owner)

### 2. Migrations SQL

```sql
-- chatbot_flows: permitir SELECT por membros da org
DROP POLICY "Users can view their own flows" ON chatbot_flows;
CREATE POLICY "Users can view organization flows" ON chatbot_flows
  FOR SELECT USING (user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- chatbot_flow_nodes: permitir SELECT por membros da org
DROP POLICY "Users can view their own nodes" ON chatbot_flow_nodes;
CREATE POLICY "Users can view organization nodes" ON chatbot_flow_nodes
  FOR SELECT USING (user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- chatbot_flow_edges: permitir SELECT por membros da org
DROP POLICY "Users can view their own edges" ON chatbot_flow_edges;
CREATE POLICY "Users can view organization edges" ON chatbot_flow_edges
  FOR SELECT USING (user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- chatbot_executions: substituir ALL por políticas granulares
DROP POLICY "Users can manage their chatbot executions" ON chatbot_executions;
CREATE POLICY "Users can view organization executions" ON chatbot_executions
  FOR SELECT USING (user_id IN (SELECT get_organization_member_ids(auth.uid())));
CREATE POLICY "Users can insert their own executions" ON chatbot_executions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update organization executions" ON chatbot_executions
  FOR UPDATE USING (user_id IN (SELECT get_organization_member_ids(auth.uid())));
CREATE POLICY "Users can delete their own executions" ON chatbot_executions
  FOR DELETE USING (auth.uid() = user_id);
```

Nenhuma alteração de código frontend é necessária — o hook `useChatbotFlows` já busca sem filtro de `user_id` (confia no RLS).

