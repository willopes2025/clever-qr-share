## Objetivo
Exibir os campos personalizados sempre em ordem alfabética (por `field_name`, locale pt-BR, case-insensitive) em toda a aplicação — tanto no diálogo "Campos Personalizados" do anexo quanto em qualquer seletor/picker de campo (relatórios dinâmicos, filtros de listas, editor de campos do card, autocomplete de variáveis em templates/chatbot, etc.).

## Abordagem
Fazer a ordenação em **um único ponto**: o hook `src/hooks/useCustomFields.ts`, que é a fonte usada por praticamente todas as telas listadas. Assim a mudança se propaga automaticamente para:

- `components/inbox/CustomFieldsManager.tsx` (diálogo do anexo)
- `components/dynamic-reports/DynamicReportDialog.tsx` (seleção de variável do relatório)
- `components/contacts/FieldSelector.tsx` e demais seletores de campo em contatos/leads
- `components/funnels/*` (Card fields, Columns config, Bulk edit, Deal form, Automation form, Merge, Broadcast)
- `components/inbox/lead-panel/*` (Contact/Lead fields sections e ConfigureTabFieldsDialog)
- `components/templates/VariableAutocomplete.tsx` e `components/shared/VariableChipsSelector.tsx`
- `components/chatbot-builder/ConditionVariablePicker.tsx` e `ChatbotNodeConfig.tsx`
- `components/broadcasts/CustomFieldFilterRow.tsx`, `components/leads/ImportLeadsDialog.tsx`, `components/forms/builder/FieldProperties.tsx`, etc.

## Mudanças
1. **`src/hooks/useCustomFields.ts`**
   - Remover o `.order('display_order', ...)` no `queryFn`.
   - Ordenar em memória usando `field_name.localeCompare(b.field_name, 'pt-BR', { sensitivity: 'base' })` antes de retornar `data`.
   - Os arrays derivados `contactFieldDefinitions` e `leadFieldDefinitions` herdam a ordem automaticamente.

2. **`src/components/inbox/CustomFieldsManager.tsx`**
   - Trocar o sort local `a.display_order - b.display_order` (linha 71) pelo mesmo `localeCompare` alfabético, para o diálogo do anexo refletir a mudança mesmo que ainda receba dados por display_order de outras origens.

Nenhuma outra tela precisa de edição — todas leem via `useCustomFields` ou já iteram sobre o array já ordenado.

## Fora do escopo
- Não altero `display_order` no banco nem removo a coluna (ainda pode ser útil futuramente para drag-and-drop opcional).
- Não mexo em campos padrão (nome, telefone, e-mail) que aparecem antes dos personalizados em alguns formulários — apenas os personalizados são reordenados.
