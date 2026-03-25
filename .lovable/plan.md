

## Adicionar campo "Valor da Venda" no construtor de formulários

### Problema
Não existe uma opção no construtor de formulários para capturar o valor da venda e mapeá-lo automaticamente para o campo `value` do deal no funil.

### Solução
Adicionar um novo tipo de campo especial "Valor da Venda" na paleta de componentes e um novo `mapping_type` chamado `deal_native_field` que mapeia para campos nativos do deal (como `value`).

### Mudanças

**1. FieldPalette.tsx — Novo botão "Valor da Venda"**
- Adicionar na categoria "Especiais": `{ type: 'deal_value', label: 'Valor da Venda', icon: DollarSign, category: 'Especiais' }`
- Auto-mapear com `mapping_type: 'deal_native_field'` e `mapping_target: 'value'`
- O campo será criado como tipo `number` internamente

**2. FieldProperties.tsx — Novo mapping type**
- Adicionar opção `deal_native_field` → "Campo nativo do Lead/Deal" no select de mapeamento
- Quando selecionado, exibir sub-select com opções: `value` (Valor da Venda), `title` (Título do Deal)
- Exibir texto explicativo: "O valor será salvo diretamente no campo do lead no funil"

**3. submit-form/index.ts — Processar o novo mapping**
- No loop de processamento de campos (linha ~120), adicionar tratamento para `mapping_type === 'deal_native_field'`
- Acumular os valores em um novo objeto `dealNativeFields` (ex: `{ value: 1500 }`)
- Na criação do deal (linha ~492), mesclar `dealNativeFields` no `dealInsertData` (ex: `dealInsertData.value = dealNativeFields.value`)
- Na atualização de deal existente (linha ~520), também atualizar campos nativos com `update({ value: ... })`

### Arquivos a editar
- `src/components/forms/builder/FieldPalette.tsx` — novo botão + auto-mapping
- `src/components/forms/builder/FieldProperties.tsx` — novo mapping type no select
- `supabase/functions/submit-form/index.ts` — processar `deal_native_field` e salvar no deal

