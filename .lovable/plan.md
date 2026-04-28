## Problema confirmado pela imagem

A coluna **"Cidade do Evento"** no formato de linha do funil está exibindo um filtro de **intervalo de datas** (dois campos `dd/mm/yyyy`) quando deveria exibir um filtro de **texto**, pois o campo é do tipo texto — apenas o nome contém a palavra "evento".

O mesmo problema afeta potencialmente outras colunas customizadas cujo nome contenha palavras-chave como `evento`, `data`, `vencimento`, `nascimento`, `pagamento`, `prazo`, `consulta`, `agendamento`, `saída`, mesmo quando o tipo real do campo é texto, número, select, etc.

## Causa raiz

A função `isDateLikeFieldName` (em `src/lib/date-utils.ts`) é uma heurística baseada em palavras-chave do **nome** do campo. Em `src/components/funnels/FunnelListView.tsx` ela é aplicada em três pontos como `OR` em vez de `fallback`, sobrepondo o `field_type` declarado:

1. **Linhas 1188-1189** — escolha do input de filtro (data vs. texto)
2. **Linhas 658-659** — chave de ordenação (timestamp vs. string)
3. **Linha 1012** — formatação da célula (data vs. texto bruto)

A palavra "evento" na regex casa com "Cidade do Evento", "Bairro do Evento", "Local do Evento", etc.

## Correção

### 1. `src/components/funnels/FunnelListView.tsx`

Trocar a lógica nos três pontos para **respeitar o `field_type` declarado** e só usar a heurística como fallback quando não há definição do campo:

```ts
const isDateField = fieldDef
  ? (fieldDef.field_type === 'date' || fieldDef.field_type === 'datetime')
  : isDateLikeFieldName(col.label || '');
```

Pontos a alterar:
- `renderFilterInput` (linhas 1184-1215) — escolha do tipo de filtro
- `getSortKey` dentro de `sortedDeals` (linhas 646-670) — comparador de ordenação
- Renderização da célula em `renderCellContent` (linha ~1012) — formatação do valor

### 2. Melhoria do filtro por tipo de campo (mesmo arquivo)

Aproveitar a correção para que o filtro escolha o input apropriado para cada tipo do `field_type`:

- `date` / `datetime` → dois inputs `type="date"` (intervalo De/Até) — comportamento atual
- `number` → `<Input type="number">` com filtro de igualdade ou contém
- `select` / `multi_select` → `<Select>` populado com `fieldDef.options`
- `boolean` / `switch` → `<Select>` com Sim/Não/Todos
- `phone`, `email`, `url`, `text` (e qualquer outro/desconhecido) → `<Input>` de texto (padrão atual)

### 3. Sem mudanças em `src/lib/date-utils.ts`

A regex permanece útil para outros componentes que tratam valores **sem** definição de campo (ex.: importações, pré-visualizações). A correção é localizada onde a heurística estava sendo usada incorretamente como prioridade sobre o tipo declarado.

## Verificação após aplicar

Revisar no formato de linha cada coluna visível no print:
- "Telefone", "Nome do Líder", "Cidade do Evento", "Bairro do Evento", "Município", "UF", "Forma de Pg Saldo" → filtro de **texto**
- Qualquer campo cujo `field_type` for realmente `date`/`datetime` → filtro de **intervalo de datas**
- Confirmar que ordenação A→Z / Z→A funciona corretamente em campos de texto que antes eram tratados como data

## Arquivos a editar

- `src/components/funnels/FunnelListView.tsx` (3 condições corrigidas + suporte a `number`/`select`/`boolean` no filtro)
