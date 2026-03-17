

## Problema

Atualmente, para usar o campo "Buscar lead por código", o usuário precisa:
1. Adicionar um campo de texto (ex: `short_text`)
2. Ir nas propriedades e mudar o mapeamento para "Buscar lead por código"

Isso não é intuitivo. Além disso, se o campo for criado como tipo `hidden`, ele não aparece no formulário público.

## Solução

Adicionar um tipo de campo dedicado na paleta de componentes chamado **"Código do Lead"** que:
- Aparece na categoria "Especiais" da paleta
- Ao ser adicionado, cria automaticamente um campo `short_text` com `mapping_type: 'lookup_by_display_id'`
- Renderiza como input de texto visível no formulário público
- O assistente consegue preencher o código do lead normalmente

## Alterações

### 1. `src/components/forms/builder/FieldPalette.tsx`
- Adicionar na lista `fieldTypes` (categoria "Especiais"):
  ```
  { type: 'short_text', label: 'Código do Lead', icon: Hash, category: 'Especiais' }
  ```
- Ajustar `handleAddField` para que, quando o label for "Código do Lead", defina automaticamente `mapping_type: 'lookup_by_display_id'` e `mapping_target: 'contact_display_id'`

### 2. `supabase/functions/public-form/index.ts`
- Nenhuma alteração necessária — o campo `short_text` já renderiza como input de texto visível no formulário público.

Resultado: o campo aparece visível no formulário, o assistente preenche o código do lead, e o sistema localiza e atualiza o lead correto.

