

## Plano: Unificar instâncias Evolution e Meta no mesmo dialog de acesso do membro

### Situação atual
Hoje existem **dois dialogs separados** no menu do membro da equipe:
- "Instâncias de Acesso" — mostra apenas instâncias Evolution (WhatsApp Lite)
- "Números Meta (Oficial)" — mostra apenas números Meta (WhatsApp Business API)

O usuário precisa abrir dois dialogs diferentes para configurar o acesso completo de um membro.

### O que será feito

Unificar tudo em **um único dialog** chamado "Instâncias de Acesso" que exibe ambos os tipos, separados por seções visuais com badges indicando o provedor (Lite / API).

### Alterações

1. **`MemberInstancesDialog.tsx`** — Refatorar para incluir ambos os tipos:
   - Importar `useMetaWhatsAppNumbers` e `useMemberMetaNumbers` além dos hooks Evolution já existentes
   - Adicionar estado para seleção de números Meta (`selectedMetaNumbers`, `allMetaSelected`)
   - Dividir a lista em duas seções: "WhatsApp Lite (Evolution)" e "WhatsApp Business (Meta)", cada uma com seu checkbox "Todos"
   - Usar o `ProviderBadge` existente para diferenciar visualmente
   - No `handleSave`, salvar ambas as permissões (chamar `updateMemberInstances` + `updateMemberMetaNumbers`)

2. **`TeamSettings.tsx`** — Simplificar o menu:
   - Remover o item de menu "Números Meta (Oficial)" separado
   - Remover estado `metaNumbersDialogOpen` e handler `handleOpenMetaNumbers`
   - Remover o `MemberMetaNumbersDialog` separado
   - Manter apenas o item "Instâncias de Acesso" que agora abre o dialog unificado

3. **`MemberMetaNumbersDialog.tsx`** — Pode ser removido ou mantido como arquivo legado (o código será absorvido pelo dialog unificado).

### Detalhes técnicos
- O dialog unificado terá um `ScrollArea` com duas seções separadas por headers
- Cada seção mantém sua lógica independente de "Todos" vs "Específicos"
- O save dispara ambas as mutations em paralelo (`Promise.all`)
- Nenhuma alteração no banco de dados é necessária — as tabelas `team_member_instances` e `team_member_meta_numbers` continuam sendo usadas separadamente

