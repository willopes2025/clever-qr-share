

## Corrigir vazamento de instâncias no diálogo "Instâncias de Acesso"

### Diagnóstico confirmado

O diálogo está mostrando instâncias de outras organizações (ex.: Goncalves Dias, Lucas, Aline, Matheus, Pedro) ao configurar acesso da membro **Weslaine Borel** (membro do William em "Equipe Grupo Wil").

Causa raiz: o filtro atual usa `useOrganization()`, que retorna a **organização do usuário logado**, não a **organização do membro sendo editado**. Resultado:

- Se quem está abrindo o diálogo é um administrador do sistema (com RLS amplo) ou alguém de outra organização, `ownerId` não bate com o dono real da organização do membro.
- A condição `(!ownerId || i.user_id === ownerId)` então:
  - se `ownerId` existir mas for de OUTRA org → as instâncias do dono certo somem;
  - se o conjunto de instâncias retornadas pelo RLS contiver instâncias de várias orgs (ex.: super admin), todas vazam.

Além disso, mesmo quando o owner da org bate, ainda há outro problema: instâncias criadas por **membros da equipe** ficam com `user_id = membro` (não o owner), então elas seriam **erroneamente ocultadas**.

### O que vou ajustar

#### 1. Resolver o owner correto a partir do próprio membro
Arquivo: `src/components/settings/MemberInstancesDialog.tsx`

- Remover o uso de `useOrganization()` para definir `ownerId`.
- Buscar a organização diretamente pelo `member.organization_id` (que já vem na prop `member`) e obter o `owner_id` real dessa organização.
- Cache via React Query (`['organization', member.organization_id]`).

#### 2. Considerar TODOS os user_ids da organização do membro
- Buscar via `team_members` todos os `user_id` ativos da `member.organization_id` + o `owner_id` da organização.
- Filtrar instâncias e números Meta por `instance.user_id ∈ orgUserIds`.

Isso garante que apareçam tanto as instâncias criadas pelo dono (assinante) quanto as criadas por membros da própria equipe — e nada de fora da organização.

#### 3. Mesmo tratamento para os números Meta
- Aplicar a mesma checagem `n.user_id ∈ orgUserIds` em `activeMetaNumbers`.

#### 4. Estado de carregamento seguro
- Enquanto os `orgUserIds` estiverem carregando, **não renderizar a lista** (evita flash de "todas as instâncias do sistema") — mostrar o spinner já existente.
- Se a busca falhar, exibir lista vazia em vez de cair no fallback permissivo.

### Arquivos afetados

- `src/components/settings/MemberInstancesDialog.tsx` — buscar owner + user_ids da org do **membro** e filtrar por esse conjunto.

### Resultado esperado

- Ao configurar acesso de Weslaine Borel (org "Equipe Grupo Wil"), aparecerão apenas as 7 instâncias dessa organização (Brasil Visão Cidadã, Centro de Saúde Visual, Centro de Saúde Visual 2, James & Jesse's, Notificação, Seven 7685, Seven Cobrança) — nada de Lucas, Aline, Matheus, Pedro etc.
- Mesmo comportamento aplicado aos números Meta.
- Funciona corretamente independentemente de quem está logado (admin do sistema, dono da org ou outro membro com permissão).
- Instâncias criadas por membros da equipe continuam visíveis para a própria equipe (não somem mais).

