

## Scroll horizontal com cursor de mãozinha (grab-to-scroll) no Kanban e Lista

### O que será feito
Adicionar funcionalidade de **drag-to-scroll** horizontal nas views Kanban e Lista do funil: o cursor muda para uma mãozinha (grab), e ao clicar e arrastar, o conteúdo rola horizontalmente — igual ao comportamento mostrado na imagem de referência.

### Implementação

**1. Criar hook reutilizável `useGrabScroll`** (`src/hooks/useGrabScroll.ts`)
- Hook que retorna um `ref` e event handlers (`onMouseDown`, `onMouseMove`, `onMouseUp`, `onMouseLeave`)
- Controla estado `isGrabbing` para alternar cursor entre `grab` e `grabbing`
- Calcula deslocamento horizontal baseado no movimento do mouse
- Ignora drag quando o clique origina de elementos interativos (botões, inputs, links)

**2. Aplicar no `FunnelKanbanView.tsx`**
- Substituir ou envolver o `<ScrollArea>` atual (linha 99) com um `div` que usa o hook `useGrabScroll`
- Adicionar classes CSS `cursor-grab active:cursor-grabbing` no container
- Manter o scroll nativo via `overflow-x: auto` no container

**3. Aplicar no `FunnelListView.tsx`**
- Mesmo tratamento para a área de scroll horizontal, se existir

### Detalhes técnicos

O hook `useGrabScroll`:
```typescript
// Lógica principal
onMouseDown → salva posição inicial X + scrollLeft, seta isGrabbing = true
onMouseMove → calcula delta e aplica scrollLeft
onMouseUp/onMouseLeave → seta isGrabbing = false
```

Classes CSS no container:
```
cursor-grab select-none [&.grabbing]:cursor-grabbing
```

Importante: não interferir com o drag-and-drop de cards entre colunas — o hook deve ignorar eventos que se originam dos cards arrastáveis (verificar `e.target`).

