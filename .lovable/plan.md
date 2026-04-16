

# Adicionar Campos Personalizados no Formulário de Deal (Funil)

## Problema
O formulário "Editar Deal" no funil mostra apenas campos personalizados já existentes (via `DealCustomFieldsEditor`), mas **não oferece opção de adicionar novos campos** — diferente do formulário de contatos que tem o botão "Adicionar campo" com `FieldSelector` e `InlineFieldCreator`.

## Solução
Adicionar ao `DealCustomFieldsEditor` a mesma mecânica de seleção e criação de campos que existe no `ContactFormDialog`:

1. **Botão "Adicionar campo"** com dropdown listando campos do tipo `lead` ainda não adicionados
2. **Opção "Criar novo campo..."** inline para criar campos personalizados diretamente
3. Campos adicionados aparecem dinamicamente no formulário

## Alterações

### `DealCustomFieldsEditor.tsx`
- Importar `FieldSelector` e `InlineFieldCreator` de `@/components/contacts/`
- Manter estado `addedFieldIds` (campos visíveis) e `showCreateField`
- Inicializar `addedFieldIds` com os campos que já têm valor em `values`
- Renderizar `FieldSelector` com `availableFields` filtrado por `entity_type === 'lead'`
- Renderizar `InlineFieldCreator` com `defaultEntityType='lead'` quando o usuário clicar "Criar novo campo"
- Ao criar campo, chamar `createFieldDefinition` do hook `useCustomFields` e adicionar ao `addedFieldIds`

### `DealFormDialog.tsx`
- Nenhuma alteração necessária — o `DealCustomFieldsEditor` já está integrado na linha 349

## Resultado
O usuário poderá adicionar e criar campos personalizados do tipo "lead" diretamente ao editar ou criar um deal no funil, com a mesma experiência que já existe no formulário de contatos.

