

## Plano: Melhorar tabela de Tarefas

### Problemas identificados
1. Faltam dados do lead (código, nome, telefone) na tabela
2. A coluna "Origem" não é clicável para abrir o chat
3. Status só tem "Pendente" e "Concluída" — falta "Atrasada"
4. Ao concluir, não pede o que foi feito
5. Filtro de responsável mostra IDs duplicados (puxa tanto `user_id` quanto `assigned_to` de todas as tarefas, gerando repetição)

### Alterações

#### 1. `useAllTasks.ts` — Buscar dados do contato junto
- Para `conversation_tasks`: fazer join com `contacts` via `contact_id` para trazer `contact_display_id`, `name`, `phone`
- Para `deal_tasks`: fazer join com `funnel_deals(title, contact_id, contacts(contact_display_id, name, phone))`
- Adicionar esses campos ao retorno: `contact_name`, `contact_phone`, `contact_display_id`, `conversation_id`
- Extrair lista de responsáveis únicos (deduplicados) baseada em `assigned_to` — não misturar com `user_id`

#### 2. `Tasks.tsx` — Colunas e layout da tabela
- Adicionar colunas: **Código** (`contact_display_id`), **Lead** (nome + telefone)
- **Origem** vira um link clicável que navega para `/inbox?conversationId=X` ou `/inbox?contactId=X`
- **Status** com 3 estados:
  - "Atrasada" (badge vermelha) — `due_date < hoje` e não concluída
  - "Pendente" (badge secundária) — sem vencimento ou não venceu ainda
  - "Concluída" (badge verde/default) — tem `completed_at`
- Filtro de status: "Todas", "Pendentes", "Atrasadas", "Concluídas"
- **Popup de conclusão**: ao clicar no checkbox para concluir, abrir um `Dialog` com `Textarea` pedindo "O que foi feito?" — só salva `completed_at` após confirmar

#### 3. Corrigir filtro de responsável
- No filtro de responsável, usar apenas `assigned_to` (quem está designado), removendo `user_id` duplicado
- Deduplicar a lista de IDs antes de popular o select

### Arquivos a modificar
- `src/hooks/useAllTasks.ts` — joins com contacts, retornar dados do lead
- `src/pages/Tasks.tsx` — novas colunas, status atrasado, popup conclusão, fix filtro

