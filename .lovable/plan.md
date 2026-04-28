## Objetivo
Permitir reordenar as colunas no formato de Lista do Funnel arrastando os cabeçalhos (headers) para a esquerda ou direita, salvando a nova ordem automaticamente.

## Como vai funcionar (UX)
- Cada cabeçalho de coluna na visualização de lista terá um pequeno "ícone de alça" (grip) no início, indicando que pode ser arrastado.
- O usuário clica e segura em cima do cabeçalho e arrasta para a posição desejada.
- Um indicador visual (linha azul vertical) mostra onde a coluna será inserida.
- Ao soltar, a ordem é atualizada na tela imediatamente e salva automaticamente no banco (mesma rota já usada hoje pelo `ColumnsConfigDialog`).
- Colunas fixas (checkbox de seleção à esquerda e ações à direita) NÃO serão arrastáveis.

## Implementação técnica
Arquivo: `src/components/funnels/FunnelListView.tsx`

1. **Drag-and-drop nativo HTML5** (sem nova dependência):
   - Adicionar `draggable`, `onDragStart`, `onDragOver`, `onDragEnter`, `onDragLeave`, `onDrop` e `onDragEnd` no `<TableHead>` de cada coluna dentro do `orderedVisibleColumns.map(...)`.
   - Estados locais novos:
     - `draggedColumnId: string | null` — coluna sendo arrastada.
     - `dragOverColumnId: string | null` — coluna alvo para feedback visual.

2. **Lógica de reordenação**:
   - No `onDrop`, calcular nova ordem inserindo `draggedColumnId` antes/depois do alvo (com base na posição relativa).
   - Reutilizar a função existente `handleSaveColumnConfig(visibleColumns, newOrder)` para persistir no Supabase (`funnel_column_configs.column_order`).
   - Atualizar `setColumnOrder` localmente para feedback imediato.

3. **Indicador visual**:
   - Adicionar borda esquerda/direita azul (`border-l-2 border-primary`) no `<TableHead>` quando ele é o `dragOverColumnId`.
   - Cursor `cursor-grab` no header normal e `cursor-grabbing` durante arrasto.
   - Pequeno ícone `GripVertical` (lucide-react) à esquerda do nome da coluna no `renderColumnHeader`.

4. **Não interferir nos outros gestos**:
   - O Popover de filtro/ordenação continua abrindo ao clicar no botão do header (não no ícone de grip).
   - Apenas a área do "grip" inicia o arrasto (`onDragStart` só dispara via atributo `draggable` no wrapper externo, mas usamos `onMouseDown` no botão do filtro para impedir o drag quando o usuário interage com o filtro).

5. **Persistência**:
   - Após `onDrop`, chamar `handleSaveColumnConfig(visibleColumns, newOrder)` que já faz upsert em `funnel_column_configs`.
   - Toast de sucesso já vem do fluxo existente.

## Fora de escopo
- Reordenar linhas (deals) por arrasto.
- Redimensionar colunas (largura).
- Aplicar a nova ordem a outros membros automaticamente (continua disponível via diálogo "Configurar Colunas").