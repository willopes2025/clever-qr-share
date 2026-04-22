

## Corrigir vazamento de instâncias e números nos filtros do Inbox e demais telas

### Diagnóstico

Mesmo após as correções anteriores em `useMetaWhatsAppNumbers` e `useMetaNumbersMap`, os filtros do Inbox ainda mostram instâncias/números de outras assinaturas para alguns usuários. Causa:

1. **`useWhatsAppInstances`** (usado em 16 arquivos: `ConversationFilters`, `MessageView`, `NewConversationDialog`, `Instances`, `Warming`, `TeamSettings`, `ApiSettings`, `SelectInstanceDialog` etc.) **não tem filtro por organização** — depende 100% do RLS. Quando o RLS concede acesso amplo (admin do sistema, política herdada), TODAS as instâncias do sistema vazam.
2. **`MemberMetaNumbersDialog`** (standalone) ainda filtra pela org do **usuário logado**, não pela org do **membro sendo editado** — então admins gerenciando outras orgs veem números errados.

### O que vou ajustar

#### 1. `src/hooks/useWhatsAppInstances.ts` — filtrar por organização do logado
- Adicionar query `orgUserIds` (mesmo padrão de `useMetaWhatsAppNumbers` / `useMetaNumbersMap`):
  - `owner_id` da organização do usuário logado + todos os `team_members` ativos.
- Filtrar `instances` por `i.user_id ∈ orgUserIds`.
- Habilitar a query principal apenas quando `orgUserIds !== undefined` (evita flash com lista global).
- Invalidar cache nas mutations existentes (já existe).

Isso elimina o vazamento em **todas as 16 telas** que consomem o hook (Inbox filters, Inbox MessageView, NewConversation, Instances, Warming, TeamSettings, ApiSettings, SelectInstance de campanhas, automações etc.).

#### 2. `src/components/settings/MemberMetaNumbersDialog.tsx` — usar org do membro editado
- Adicionar `useQuery(['org-user-ids', member.organization_id])` que resolve `owner_id` + membros ativos da `member.organization_id`.
- Filtrar `activeNumbers` por `n.user_id ∈ orgUserIdSet`.
- Bloquear renderização da lista enquanto `orgUserIds` não carregar.

### Arquivos afetados

- `src/hooks/useWhatsAppInstances.ts` — adicionar resolução de `orgUserIds` e filtro defensivo na query principal.
- `src/components/settings/MemberMetaNumbersDialog.tsx` — buscar org do membro editado e filtrar números Meta.

### Resultado esperado

- **Filtros do Inbox** (`ConversationFilters`): cada usuário verá apenas as instâncias e números Meta da própria organização.
- **MessageView, NewConversationDialog, SelectInstanceDialog**: idem — sem instâncias de outras assinaturas no seletor de remetente, novo contato ou campanhas.
- **Instances, Warming, TeamSettings, ApiSettings**: páginas administrativas mostram apenas instâncias da própria assinatura.
- **MemberMetaNumbersDialog**: ao configurar acesso de um membro, mostra somente os números Meta da organização daquele membro (não da org do admin logado).
- Comportamento consistente para owners, admins de organização e admin do sistema (William continua vendo só os seus, mesmo com RLS amplo).

