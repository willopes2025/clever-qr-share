

## Plano: Liberar RLS para membros da organização (admins)

### Problema

Muitas tabelas têm políticas de UPDATE, DELETE e INSERT restritas apenas ao `user_id` do criador (`auth.uid() = user_id`). Quando dois admins estão na mesma organização, um não consegue editar, excluir ou gerenciar dados criados pelo outro, mesmo sendo admin.

### Tabelas que precisam de correção

Identificamos **~25 tabelas** onde as políticas de escrita (UPDATE/DELETE/INSERT) não incluem acesso organizacional via `get_organization_member_ids()`. As principais:

| Tabela | Operações restritas |
|--------|-------------------|
| `broadcast_lists` | UPDATE, DELETE |
| `broadcast_list_contacts` | todas (via join) |
| `broadcast_sends` | SELECT, UPDATE, DELETE |
| `tags` | UPDATE, DELETE |
| `conversation_tags` | UPDATE, DELETE |
| `conversation_tag_assignments` | todas (via join com conversations) |
| `conversation_notes` | UPDATE, DELETE |
| `conversation_stage_data` | todas (via join) |
| `custom_field_definitions` | UPDATE, DELETE |
| `funnels` | UPDATE, DELETE |
| `chatbot_flows/nodes/edges` | UPDATE, DELETE |
| `inbox_messages` | UPDATE |
| `meta_templates` | todas |
| `meta_whatsapp_numbers` | UPDATE, DELETE |
| `template_variations` | todas (via join) |
| `task_types` | UPDATE, DELETE |
| `ai_agent_stages/variables` | todas |
| `voip_calls` | UPDATE, DELETE |
| `instagram_scrape_results` | UPDATE, DELETE |
| `conversation_analysis_reports` | todas |

### Solução

Uma **migração SQL única** que atualiza todas as políticas restritivas, mudando de:
```sql
-- Antes
USING (auth.uid() = user_id)
```
Para:
```sql
-- Depois
USING (
  auth.uid() = user_id 
  OR user_id IN (SELECT get_organization_member_ids(auth.uid()))
)
```

Para tabelas com join (como `broadcast_list_contacts`, `conversation_tag_assignments`, `template_variations`), a lógica será atualizada na tabela pai referenciada.

### Tabelas excluídas (pessoais)
- `dashboard_configs` (configuração pessoal do dashboard)
- `wil_chat_sessions` (sessões pessoais do assistente)
- `user_settings`, `user_ai_tokens` (dados pessoais)
- `notification_preferences` (preferências pessoais)
- `lead_panel_tabs` (tabs pessoais)

### Detalhes técnicos
- Usa `DROP POLICY IF EXISTS` + `CREATE POLICY` para cada política
- Mantém `get_organization_member_ids()` (função `SECURITY DEFINER` já existente) para evitar recursão
- Sem alteração de schema, apenas políticas RLS
- INSERT policies que usam `auth.uid() = user_id` serão mantidas na maioria dos casos (o registro é criado pelo usuário atual)

