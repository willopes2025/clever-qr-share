

## Adicionar campos de telefone padrão (Comercial, Celular, Pessoal) no formulário

### Problema
O formulário só tem um campo "Telefone" genérico. O usuário quer opções de telefone categorizados (Comercial, Celular, Pessoal) que sejam salvos automaticamente como telefones adicionais do contato (`custom_fields.additional_phones`).

### Solução
Adicionar 3 novos botões na paleta do form builder, cada um pré-configurado com um novo `mapping_type` chamado `additional_phone` que salva o número no array `additional_phones` do contato com o label correspondente.

### Mudanças

**1. FieldPalette.tsx — 3 novos botões na categoria "Especiais"**
- `{ type: 'phone_commercial', label: 'Tel. Comercial', icon: Phone }` 
- `{ type: 'phone_mobile', label: 'Celular', icon: Phone }`
- `{ type: 'phone_personal', label: 'Tel. Pessoal', icon: Phone }`
- Cada um auto-mapeado com `mapping_type: 'additional_phone'` e `mapping_target` = `'Comercial'`, `'Celular'`, `'Pessoal'` respectivamente
- `field_type` real será `phone` (reutiliza formatação/validação existente)

**2. FieldProperties.tsx — Novo mapping type no select**
- Adicionar opção `additional_phone` → "Telefone adicional do contato" no select de mapeamento
- Quando selecionado, exibir input para o rótulo (label) do telefone (ex: "Comercial", "Pessoal")
- Texto explicativo: "Será salvo como telefone adicional no perfil do contato"

**3. submit-form/index.ts — Processar `additional_phone`**
- No loop de campos, quando `mapping_type === 'additional_phone'`:
  - Normalizar o número com DDI
  - Acumular em um array `additionalPhones`
- Após criar/atualizar o contato, fazer merge do array `additionalPhones` com o `custom_fields.additional_phones` existente (evitando duplicatas por número)
- Atualizar o contato com o novo array

### Arquivos a editar
- `src/components/forms/builder/FieldPalette.tsx` — 3 novos botões + auto-mapping
- `src/components/forms/builder/FieldProperties.tsx` — novo mapping type
- `supabase/functions/submit-form/index.ts` — processar e salvar additional_phones

