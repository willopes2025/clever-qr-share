

## Plano: Adicionar "Conversas Internas" e "Tarefas" como páginas na sidebar

### Contexto
Atualmente, o chat interno (`InternalChatTab`) existe apenas como uma aba dentro da conversa no Inbox. Não há página dedicada. As tarefas (`conversation_tasks` e `deal_tasks`) são gerenciadas dentro de cada conversa/deal individualmente, sem visão centralizada.

### O que será feito

Criar **duas novas páginas** com rotas próprias e adicioná-las na sidebar (desktop e mobile).

---

### 1. Página "Conversas Internas" (`/internal-chat`)

- Nova página `src/pages/InternalChat.tsx` com layout de chat entre membros da equipe
- Lista de sessões de chat interno (tabela `internal_chat_sessions`) na lateral esquerda
- Área de mensagens na direita, reutilizando lógica do `useInternalMessages`
- Diferente do componente atual que é vinculado a uma conversa específica — aqui será uma interface de mensagens diretas entre membros da equipe (sem vínculo obrigatório com contato/conversa)
- Componentes: `InternalChatPage` com lista de membros/sessões + área de chat

### 2. Página "Tarefas" (`/tasks`)

- Nova página `src/pages/Tasks.tsx` com tabela centralizada de todas as tarefas
- Busca dados de `conversation_tasks` e `deal_tasks` (similar ao `useUnifiedTasks` mas sem filtro por conversa/deal)
- **Admin**: vê todas as tarefas de todos os usuários da organização
- **Não-admin**: vê apenas tarefas onde `user_id` ou `assigned_to` = seu ID
- Colunas da tabela: Título, Responsável, Prioridade, Data de Vencimento, Status (pendente/concluída), Origem (Conversa/Deal)
- Filtros: por status, prioridade, responsável, data
- Hook `useAllTasks` que busca ambas as tabelas com a lógica de permissão

### 3. Sidebar (`DashboardSidebar.tsx` + `MobileSidebarDrawer.tsx`)

- Adicionar no grupo "Atendimento e Vendas":
  - `{ icon: MessagesSquare, label: "Chat Interno", path: "/internal-chat" }`
  - `{ icon: CheckSquare, label: "Tarefas", path: "/tasks" }`

### 4. Rotas (`App.tsx`)

- Adicionar rotas protegidas para `/internal-chat` e `/tasks`

### Arquivos a criar
- `src/pages/InternalChat.tsx`
- `src/pages/Tasks.tsx`
- `src/hooks/useAllTasks.ts`

### Arquivos a modificar
- `src/components/DashboardSidebar.tsx` — adicionar itens na nav
- `src/components/MobileSidebarDrawer.tsx` — adicionar itens na nav mobile
- `src/App.tsx` — adicionar rotas

### Sem alterações no banco de dados
As tabelas `internal_messages`, `internal_chat_sessions`, `conversation_tasks` e `deal_tasks` já existem. A lógica de admin vs membro será feita no frontend usando `useUserRole`/`useOrganization` para verificar se é admin e filtrar os dados adequadamente via query.

