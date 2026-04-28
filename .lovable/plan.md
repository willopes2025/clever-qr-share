## Problema
Na visualização de Lista do funil, a coluna "Data da Entrada" (e potencialmente outras colunas similares de data cadastradas como texto) está exibindo o valor no formato ISO `YYYY-MM-DD` (ex.: `2026-05-15`). O esperado é o formato brasileiro `DD/MM/YYYY` (ex.: `15/05/2026`).

## Causa
O campo customizado "Data da Entrada" está cadastrado no banco com `field_type = text` em vez de `date`. Como a renderização atual só formata como data quando o `field_type` é explicitamente `date`/`datetime`, ele cai no caminho `String(val)` e mostra o valor cru (ISO).

## Solução
No arquivo `src/components/funnels/FunnelListView.tsx`, dentro do `renderCellContent` para campos customizados (e também no export CSV / `getCellValue`), adicionar um fallback: mesmo quando o campo é `text`, se o valor for uma string no padrão ISO (`YYYY-MM-DD` ou `YYYY-MM-DDTHH:MM:SS`), formatá-lo como `DD/MM/YYYY` usando `formatCustomFieldDate` (que já existe e usa `formatDateValue` do `date-utils`, respeitando o timezone `America/Sao_Paulo`).

Pontos a alterar:
1. `renderCellContent` (≈ linha 1036): após o bloco `isDateField`, adicionar regex de detecção ISO.
2. `getCellValue` (≈ linha 920): mesma lógica para manter consistência no export CSV e busca textual.

Isso garante que qualquer campo armazenado como data ISO seja exibido em `DD/MM/YYYY`, sem depender do administrador corrigir manualmente o `field_type` no Gerenciar Campos.

## Fora de escopo
- Mudar o tipo do campo no banco (continua sendo `text` — ele pode ser corrigido manualmente em "Gerenciar Campos" para também ativar o filtro de range de datas).