

## Plano: Edição de Campos Personalizados + Aprimoramentos

### Problema atual
O `CustomFieldsManager` só permite **criar** e **excluir** campos. Não existe opção de editar nome, tipo, obrigatoriedade ou opções de um campo existente.

### O que será implementado

**1. Botão de editar em cada campo existente**
- Ícone de edição (Pencil) ao lado do botão de excluir em cada campo listado no `CustomFieldsManager`
- Ao clicar, abre um formulário inline (ou substitui o item) com os dados pré-preenchidos

**2. Formulário de edição completo**
- Permite alterar: nome do campo, tipo, obrigatoriedade (switch), opções (para select/multi_select), e entity_type
- Usa `updateField` mutation já existente no `useCustomFields` hook
- Ao salvar, invalida queries de `custom-field-definitions`, `contacts`, `conversations` e `funnel-deals` para atualizar todas as interfaces

**3. Aprimoramentos sugeridos**
- **Mais tipos no manager**: O dialog atual só mostra 5 tipos (text, number, boolean, date, select). Adicionar todos os tipos suportados: email, phone, url, time, datetime, switch, multi_select
- **Validação de obrigatoriedade**: Nos editores de campos (ContactFormDialog, DealCustomFieldsEditor, CustomFieldsEditor), bloquear submit se campos obrigatórios estiverem vazios
- **Indicador visual melhorado**: Mostrar asterisco vermelho mais consistente em todas as interfaces

### Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/inbox/CustomFieldsManager.tsx` | Adicionar modo edição por campo, expandir tipos disponíveis |
| `src/hooks/useCustomFields.ts` | Ajustar `updateField.onSuccess` para invalidar também `funnel-deals` e `funnels` |
| `src/components/funnels/DealCustomFieldsEditor.tsx` | Validação de campos obrigatórios |
| `src/components/inbox/CustomFieldsEditor.tsx` | Validação de campos obrigatórios |

### Detalhes técnicos
- O hook `useCustomFields` já tem `updateField` implementado — só precisa ser chamado na UI
- A invalidação de queries no `updateField.onSuccess` será expandida para incluir `funnel-deals`, `funnels`, `contacts` e `conversations`
- O `SelectContent` do tipo será atualizado para incluir todos os 12 tipos do `FieldType`
- Nenhuma mudança de schema no banco — apenas UI e lógica de invalidação

