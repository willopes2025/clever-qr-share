

## Inbox unificado para SDR multi-empresas (`/sdr`) — controle exclusivo do owner

### Mudança de regra (em relação ao plano anterior)
Apenas **o dono do sistema** (super admin / owner do Widezap) pode:
- marcar um usuário como **SDR multi-empresa**;
- vincular esse SDR a **qualquer organização** do sistema;
- escolher **quais instâncias Evolution e números Meta** de cada empresa o SDR poderá usar.

Admins comuns (donos de cada empresa-cliente) **não** veem nem configuram essa opção. Eles continuam gerenciando só a própria equipe.

### Como vai funcionar

**Painel do owner (novo)**
1. Nova área **Configurações → SDRs Multi-Empresa** (visível apenas para `has_role(user, 'admin')` no nível global do sistema, não admin de organização).
2. Lista de SDRs cadastrados, com:
   - Email do SDR.
   - Empresas vinculadas (chips coloridos).
   - Números liberados em cada empresa (Evolution + Meta).
   - Botões: **Adicionar empresa**, **Editar números**, **Remover acesso**.
3. Botão **"Cadastrar novo SDR"** — busca usuário por email e cria o vínculo.
4. Ao adicionar uma empresa ao SDR, abre seletor de:
   - Instâncias Evolution daquela empresa (multi-seleção).
   - Números Meta daquela empresa (multi-seleção).

**Fluxo do SDR**
1. SDR faz login normalmente.
2. Sistema detecta que ele tem registros em `sdr_assignments` → redireciona para `/sdr`.
3. Tela `/sdr` é um **Inbox enxuto** (sem sidebar de funis/campanhas/configurações):
   - Lista unificada de conversas de todas as empresas/números liberados.
   - Filtro no topo: **Empresa** e **Número de origem**.
   - Badge colorido por empresa em cada conversa.
   - Painel direito de lead (somente leitura + notas + tarefas).
   - Campo de envio com seletor de remetente limitado aos números liberados.
4. SDR **não enxerga** Funis, Campanhas, Configurações, Instâncias, Chatbots, Warming, métricas administrativas.
5. SDR não pode acessar `/dashboard`, `/funnels`, etc. — qualquer rota fora de `/sdr` redireciona de volta.

### Mudanças no banco

**Nova tabela `sdr_assignments`** — vínculo SDR ↔ empresa, criado **só pelo owner**:
- `id`, `sdr_user_id`, `organization_id`, `granted_by_owner_id`, `created_at`.
- RLS:
  - INSERT/UPDATE/DELETE: apenas usuários com `has_role(auth.uid(), 'admin')` global.
  - SELECT: o próprio SDR pode ler suas linhas + admin global pode ler todas.

**Nova tabela `sdr_instance_access`** — quais instâncias Evolution o SDR vê em cada empresa:
- `id`, `sdr_assignment_id`, `instance_id`, `created_at`.

**Nova tabela `sdr_meta_number_access`** — quais números Meta o SDR vê em cada empresa:
- `id`, `sdr_assignment_id`, `meta_number_id`, `created_at`.

**Novas funções auxiliares (security definer)**:
- `is_sdr(_user_id)` → existe linha em `sdr_assignments`.
- `get_sdr_organization_ids(_user_id)` → todas as orgs vinculadas.
- `get_sdr_instance_ids(_user_id)` → todas as instâncias Evolution liberadas (união entre empresas).
- `get_sdr_meta_number_ids(_user_id)` → todos os números Meta liberados.
- `is_system_owner(_user_id)` → wrapper de `has_role(_user_id, 'admin')` para clareza.

**Ajustes de RLS**:
- `conversations`, `inbox_messages`, `contacts`, `funnel_deals` (somente leitura para SDR): aceitar o caminho `is_sdr(auth.uid()) AND <conversa pertence a número liberado para esse SDR>`.
- SDR **não** pode editar funil, campanhas, configurações ou instâncias de nenhuma empresa.

### Mudanças no app

**Roteamento (`src/App.tsx`)**
- Nova rota `/sdr` protegida por `ProtectedRoute` + novo `SdrRoute` (verifica `is_sdr`).
- Hook `useAuthRedirect`: se SDR puro → manda para `/sdr`; senão fluxo atual.
- SDR tentando acessar qualquer outra rota → redirect para `/sdr`.

**Novos componentes**
- `src/pages/SdrInbox.tsx` — Inbox unificado, layout próprio sem `DashboardLayout`.
- `src/components/SdrRoute.tsx` — guarda de rota.
- `src/hooks/useIsSdr.ts` — flag `isSdr` no client.
- `src/hooks/useSdrConversations.ts` — busca cross-org das conversas permitidas.
- `src/components/inbox/SdrConversationList.tsx` — lista com badge de empresa.
- `src/components/inbox/SdrMessageView.tsx` — banner "Respondendo como Empresa X via número Y".

**Painel do owner**
- `src/pages/Settings.tsx` — nova aba **"SDRs Multi-Empresa"**, visível só se `useAdmin().isAdmin === true` (admin global do sistema).
- `src/components/settings/SdrManagement.tsx` — lista, criação e edição de SDRs.
- `src/components/settings/sdr/AddSdrDialog.tsx` — busca usuário por email + cria assignment.
- `src/components/settings/sdr/SdrAccessDialog.tsx` — seleciona empresas + instâncias + números Meta.

### Sugestões de melhorias (mantidas)
1. **Cor por empresa** — badge colorido em cada conversa.
2. **Banner de contexto** — "Respondendo como Empresa X via número Y" antes de cada envio.
3. **Templates segmentados por empresa** — quick-replies só da empresa da conversa ativa.
4. **Notificação desktop unificada** — uma única origem para todas as empresas.
5. **Métricas do SDR** — mensagens enviadas hoje, tempo médio de resposta, conversas pendentes.
6. **Atalho `Ctrl+1..9`** — alterna rápido entre filtros de empresa.
7. **Auditoria** — toda ação do SDR registrada com `organization_id` para o admin daquela empresa visualizar.
8. **Limite opcional de mensagens/hora por SDR** — proteção anti-bloqueio.

### Arquivos afetados

**Banco (migração SQL)**
- Tabelas: `sdr_assignments`, `sdr_instance_access`, `sdr_meta_number_access`.
- Funções: `is_sdr`, `is_system_owner`, `get_sdr_organization_ids`, `get_sdr_instance_ids`, `get_sdr_meta_number_ids`.
- RLS: nova policy de leitura SDR em `conversations`, `inbox_messages`, `contacts`, `funnel_deals`.

**Frontend**
- `src/App.tsx`
- `src/pages/SdrInbox.tsx` (novo)
- `src/pages/Settings.tsx`
- `src/components/SdrRoute.tsx` (novo)
- `src/components/settings/SdrManagement.tsx` (novo)
- `src/components/settings/sdr/AddSdrDialog.tsx` (novo)
- `src/components/settings/sdr/SdrAccessDialog.tsx` (novo)
- `src/components/inbox/SdrConversationList.tsx` (novo)
- `src/components/inbox/SdrMessageView.tsx` (novo)
- `src/hooks/useIsSdr.ts` (novo)
- `src/hooks/useSdrConversations.ts` (novo)

### Resultado esperado
- **Só você (owner do Widezap)** controla a criação e os acessos de SDRs multi-empresa.
- Admins de cada empresa-cliente **não veem** essa configuração e não podem mexer.
- O SDR usa **uma única aba** (`/sdr`), com Inbox unificado das empresas e números que você liberar.
- SDR não acessa nenhuma área administrativa de nenhuma empresa.
- Empresas continuam isoladas entre si — só o SDR transita entre elas, com o escopo exato que você definir.
- Zero impacto para clientes que não usam SDR multi-empresa.

