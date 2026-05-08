## Objetivo

Criar **Equipes** dentro da organização. Uma equipe é um "perfil pronto" que guarda:

- Permissões granulares (Inbox, Funis, Campanhas, etc.)
- Instâncias WhatsApp (Evolution) liberadas
- Números Meta WhatsApp liberados
- Funis liberados (acesso padrão)

Ao anexar um membro a uma equipe, todas essas configurações são aplicadas automaticamente — sem precisar configurar manualmente um por um. Trocar a equipe do membro troca todo o pacote.

Apenas o **Owner** da organização pode criar, editar ou excluir equipes.

---

## Como vai funcionar (UX)

**Configurações → Equipe** ganha uma nova aba **"Equipes"** ao lado da lista de membros.

```text
[ Membros ]  [ Equipes ]
```

### Aba "Equipes" (visível só para Owner)
- Lista de equipes criadas (ex: "SDR", "Atendimento", "Financeiro").
- Botão **+ Nova Equipe** abre um wizard com 4 passos:
  1. **Nome e descrição** da equipe
  2. **Permissões** (mesma UI atual de `MemberPermissionsDialog`, mas salvando no template)
  3. **Instâncias WhatsApp** liberadas (mesma UI de `MemberInstancesDialog`)
  4. **Números Meta + Funis** liberados
- Cada equipe pode ser **editada** (mesmo wizard) ou **excluída** (com confirmação se houver membros anexados — pede para reatribuir antes).

### Aba "Membros" (mudança)
No card de cada membro aparece um **seletor "Equipe"** ao lado do papel (admin/membro):

```text
João Silva    [ Membro ▾ ]   [ Equipe: SDR ▾ ]   [ ⚙ Editar ]
```

Ao trocar a equipe:
- Permissões, instâncias, números Meta e funis do membro são **substituídos** pelos da equipe.
- O membro pode continuar sendo `admin` ou `member` — o papel é independente da equipe.
- Botão **"Sobrescrever individualmente"** continua disponível (caso queira ajuste pontual fora da equipe).

### Convite de novo membro
O `InviteMemberDialog` ganha um campo opcional **"Equipe"**. Se selecionado, ao aceitar o convite o membro já entra com o pacote aplicado.

---

## Estrutura técnica

### Banco de dados (migrations)

**Nova tabela `team_groups`** (perfis salvos):
- `id`, `organization_id`, `name`, `description`
- `permissions jsonb` — mesmo formato de `team_members.permissions`
- `created_at`, `updated_at`
- RLS: SELECT para membros ativos da org; INSERT/UPDATE/DELETE só para `owner_id` da organização.

**Tabelas de relacionamento N:N** (espelham as tabelas atuais por membro):
- `team_group_instances (team_group_id, instance_id)`
- `team_group_meta_numbers (team_group_id, meta_number_id)`
- `team_group_funnels (team_group_id, funnel_id)` — caso ainda não exista controle por funil, criar também `team_member_funnels` para manter paridade.

**Coluna em `team_members`:**
- `team_group_id uuid null references team_groups(id) on delete set null`

### Função aplicadora
Função SQL `apply_team_group_to_member(_member_id uuid, _group_id uuid)` (security definer) que, dentro de uma transação:
1. Copia `permissions` do grupo para o membro
2. Substitui linhas em `team_member_instances` pelas do grupo
3. Substitui linhas em `team_member_meta_numbers` pelas do grupo
4. Substitui linhas em `team_member_funnels` pelas do grupo
5. Atualiza `team_members.team_group_id`

Chamada via `supabase.rpc()` ao trocar a equipe na UI ou ao aceitar convite.

### Frontend
- Novo hook `useTeamGroups` (CRUD + listagem).
- Novo componente `TeamGroupsManager.tsx` (lista + wizard).
- Novo componente `TeamGroupFormDialog.tsx` reaproveitando os 3 dialogs existentes (`MemberPermissionsDialog`, `MemberInstancesDialog`, `MemberMetaNumbersDialog`) em modo "template".
- `TeamSettings.tsx`: adicionar abas internas **Membros / Equipes** (essa última só renderiza se `isOwner`).
- `EditMemberDialog.tsx` / cards de membro: adicionar seletor de Equipe + botão "Aplicar equipe".
- `InviteMemberDialog.tsx`: campo opcional "Equipe inicial".

### Compatibilidade
- Membros existentes ficam com `team_group_id = null` e continuam funcionando exatamente como hoje (configurações individuais permanecem intactas).
- Nada muda para quem não criar equipes.

---

## Fora do escopo
- Múltiplas equipes por membro (foi escolhido **1 equipe por membro**).
- Admins gerenciarem equipes (apenas Owner).
- Sincronização contínua: se a equipe for alterada depois, **não** propaga automaticamente para os membros já anexados — será oferecido botão "Re-sincronizar membros desta equipe" na tela da equipe (ação manual).
