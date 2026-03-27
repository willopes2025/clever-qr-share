

## Corrigir tipos de campos personalizados no diálogo de edição do lead

### Problema

Quando você clica para editar o cartão do lead (via `DealFormDialog`), o componente `DealCustomFieldsEditor` só renderiza 5 tipos de campo: `text`, `number`, `date`, `select` e `boolean`. Os tipos `time`, `datetime`, `switch`, `multi_select`, `url`, `phone` e `email` estão faltando — todos aparecem como campos vazios/não renderizados.

Os painéis laterais do inbox (`LeadFieldsSection` e `ContactFieldsSection`) já suportam todos os tipos corretamente. O problema é exclusivamente no `DealCustomFieldsEditor.tsx`.

### Solução

**Arquivo:** `src/components/funnels/DealCustomFieldsEditor.tsx`

Adicionar suporte aos tipos que faltam:

- **`switch`** → renderizar como `Switch` (igual ao `boolean`)
- **`time`** → renderizar como `<Input type="time" />`
- **`datetime`** → renderizar como combinação de `Calendar` (Popover) + `<Input type="time" />`
- **`multi_select`** → renderizar como `Select` com as opções (mesmo tratamento do `select` por enquanto)
- **`url`** → renderizar como `<Input type="url" />`
- **`phone`** → renderizar como `<Input type="tel" />`
- **`email`** → renderizar como `<Input type="email" />`

A implementação seguirá o mesmo padrão visual já usado em `LeadFieldsSection.tsx`, mantendo consistência entre os componentes.

### Resultado

Todos os campos personalizados do lead exibirão o controle correto (calendário, switch, seleção, etc.) ao editar o cartão tanto pelo inbox quanto pelo funil.

