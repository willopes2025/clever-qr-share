## Diagnóstico

O deal `06f6efac…` está com os 4 valores salvos no banco:
```
consultor: ['William']           ← array
origem_do_lead: 'Brasil Visão Cidadã'
condio_do_exame: ['Gratuito']
data_exame_consult: '2026-05-28T09:15:00'
```

Mas o card mostra:
- **Consultor** vazio
- **Origem do Lead** vazio
- **Condição do Exame** "Gratuito" ✓
- **Data Exame** com data cortada e hora `00:00`

### Causas

1. **Datetime — hora perdida.** `parseAnyDateValue` (`src/lib/date-utils.ts:156-159`) detecta strings que começam com `YYYY-MM-DD`, joga fora o `T09:15:00` e devolve só a data. O input de hora então sempre mostra `00:00`.

2. **Consultor vazio.** O campo no formulário é `checkbox` com 1 opção marcada → submissão chega como `['option6']` → `resolveOptionLabel` converte para `['William']` (array). Mas a definição em `custom_field_definitions` é `select` (single). O `<Select>` no card recebe um array como `value` e não bate com nenhuma `SelectItem` → fica em branco.

3. **Origem do Lead vazia.** Valor salvo corretamente como string `'Brasil Visão Cidadã'`, mas a definição `select` tem `options=[]`. Como o `<Select>` só renderiza `SelectItem`s a partir de `definition.options`, nada bate e o trigger fica vazio.

4. **Condição do Exame "funciona por acaso":** definição é `multi_select`, mas o `switch` em `LeadFieldsSection.renderFieldValue` não trata `multi_select` e cai no `default: text`, que faz `String(['Gratuito']) → 'Gratuito'`. Com mais de um valor ficaria `'Gratuito,Pago'`.

## Correção

### 1. `src/lib/date-utils.ts` — preservar hora em ISO datetime

Em `parseAnyDateValue`, quando a string for `YYYY-MM-DDTHH:mm…` (tem `T`), usar `new Date(val)` mantendo a hora local em vez de cortar no `T`. Manter a lógica atual para strings só-data (`YYYY-MM-DD`).

### 2. `src/components/inbox/lead-panel/LeadFieldsSection.tsx`

- **`case 'select'`**: 
  - Se `value` vier como array de 1 elemento, usar `value[0]` (cobre o legado de checkbox→select).
  - Garantir que o valor atual sempre apareça: se não estiver em `definition.options`, injetar como `SelectItem` extra no topo (mantém a UI sempre mostrando o que está salvo, mesmo com `options=[]`).
- **`case 'multi_select'`**: novo branch — renderizar lista de chips (Badges) com os valores atuais, mais um `Popover` com checkboxes das `options` para adicionar/remover; se `options` estiver vazia, mostrar só os chips com `x` para remover.
- **Datetime**: nenhuma mudança aqui — o fix do parser já cobre.

### 3. `supabase/functions/submit-form/index.ts` — normalizar select vs multi_select

Antes de aplicar `dealCustomFields`/`contactData.custom_fields`, olhar a definição em `custom_field_definitions` para a chave:
- Se definição é `select` (single) e o valor é array de 1 → desempacotar para string.
- Se definição é `multi_select` e valor é string → embrulhar em array.

Isso resolve o descompasso form-checkbox × lead-select sem mexer no schema dos formulários.

### 4. Backfill do deal atual

Atualizar `funnel_deals.06f6efac…`:
- `consultor`: `['William']` → `'William'`

Os outros campos já estão corretos; após os fixes acima vão renderizar bem.

## Detalhes técnicos

- `parseAnyDateValue` passa a usar `new Date(val)` (interpretado como local) quando há parte de hora; manter `new Date(y, m-1, d)` quando é só `YYYY-MM-DD` para evitar shift de fuso.
- O `Select` do shadcn precisa que o item exista para mostrar texto, daí a injeção do `value` corrente como `SelectItem` quando ausente.
- O backfill é em 1 linha; sem side effects (mesma chave, só tipo).
- Não há alteração de schema; nenhuma migration.
