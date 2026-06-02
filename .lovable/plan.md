## Problema

Hoje, nas respostas de formulários (`SubmissionsList.tsx`), todas as colunas usam o mesmo filtro de lista (busca + checkboxes de valores únicos), inclusive a coluna fixa **Data** (criação da resposta) e campos do formulário do tipo **date**. Isso obriga o usuário a marcar cada data uma a uma, como na imagem enviada.

## Objetivo

Quando a coluna for de data, o popover do cabeçalho deve mostrar:
- Bloco **Ordenar** (A→Z / Z→A) — mantido igual.
- Bloco **Filtrar por {label}** com um **calendário em modo intervalo** (Data inicial e Data final), em vez da busca + lista de checkboxes.

Demais colunas (texto, select, número, etc.) continuam exatamente como estão hoje.

## Mudanças

Arquivo único: `src/components/forms/submissions/SubmissionsList.tsx`

1. **Detectar colunas de data**
   - `date` (fixa, `created_at`) → sempre tratada como data.
   - Campos do formulário cujo `field_type === "date"` → tratadas como data.
   - Helper `isDateColumn(columnId)`.

2. **Novo estado de filtro de intervalo**
   - Adicionar `dateFilters: Record<string, { from?: Date; to?: Date }>` ao lado do `columnFilters` atual.
   - `hasActiveFilters` passa a considerar também `dateFilters`.
   - `clearAll()` limpa ambos.

3. **Parser de valor para Date**
   - Para a coluna `date`: usar `submission.created_at` direto.
   - Para campos `date`: ler `sub.data[field.id]` no formato `YYYY-MM-DD` (ou ISO) e converter para `Date` local (sem timezone shift, igual ao `resolveDisplayValue` atual que faz split em "T").
   - Helper `getDateValue(sub, columnId): Date | null`.

4. **Aplicação do filtro**
   - Em `filteredSubmissions`, antes do filtro de checkboxes, aplicar `dateFilters`:
     - Se `from` definido: manter quando `value >= startOfDay(from)`.
     - Se `to` definido: manter quando `value <= endOfDay(to)`.
   - Colunas de data **não** entram mais em `columnFilters` (lista de valores).

5. **Render do header para colunas de data**
   - Em `renderColumnHeader`, se `isDateColumn(columnId)`:
     - Mostrar mesmo bloco **Ordenar**.
     - Substituir bloco "Filtrar por ..." por componente `<Calendar mode="range" />` do shadcn (`@/components/ui/calendar`, `date-fns/ptBR`) com `selected={dateFilters[columnId]}` e `onSelect` atualizando o estado.
     - Resumo textual acima do calendário: "01/05/2026 → 04/05/2026" quando houver seleção.
     - Botão **Limpar** que faz `delete dateFilters[columnId]`.
   - Ícone do header continua `Filter` quando há intervalo ativo.

6. **Ordenação em colunas de data**
   - Ajustar `filteredSubmissions` para que, quando ordenando por coluna de data, comparar pelo timestamp do `getDateValue` (não pela string `dd/mm/yyyy`), garantindo ordem cronológica correta.

## Comportamento das demais opções de seleção
Verificado: hoje todas as outras colunas (texto, select, radio, número, contato) usam corretamente `getUniqueValues` + checkboxes — não precisam de mudança. Apenas as colunas de data estavam usando o filtro errado.

## Não muda
- Layout geral da tabela, exportação CSV, edição/exclusão de respostas, autenticação ou backend.
- Filtros das outras colunas.