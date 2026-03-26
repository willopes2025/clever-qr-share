

## Scroll horizontal com barra visível e drag-to-scroll na lista do funil

### Problema
A tabela da lista do funil usa `ScrollArea` do Radix, que esconde a scrollbar horizontal por padrão e não permite arrastar para rolar. O usuário quer:
1. Barra de scroll horizontal **sempre visível**
2. Cursor de "mãozinha" (grab) para arrastar a tabela horizontalmente

### Solução

**Arquivo: `src/components/funnels/FunnelListView.tsx`**

1. **Substituir o `ScrollArea`** por um `div` com overflow-x auto e estilos customizados para scrollbar sempre visível
2. **Adicionar drag-to-scroll** com `onMouseDown/Move/Up` handlers que implementam o padrão "grab & drag":
   - `cursor: grab` no estado normal
   - `cursor: grabbing` enquanto arrasta
   - No mousedown, salvar posição inicial; no mousemove, calcular delta e aplicar `scrollLeft`

### Detalhes técnicos

- Criar um `useRef` para o container scrollable
- Adicionar estado `isDragging` + `startX` + `scrollLeftStart`
- CSS: usar classes Tailwind `overflow-x-auto cursor-grab active:cursor-grabbing` + CSS customizado para exibir a scrollbar (`::-webkit-scrollbar` com altura e cor visíveis)
- Remover imports de `ScrollArea` e `ScrollBar` nesse componente

