

## Problema

O painel do lead tem largura fixa de `w-96` (384px). O `ScrollArea` dentro do `RightSidePanel` controla o scroll vertical, mas os componentes filhos (abas, campos, etc.) não respeitam essa largura máxima. Quando muitas abas são adicionadas ou campos com conteúdo largo são exibidos, o conteúdo interno força o painel a expandir horizontalmente, empurrando elementos para fora da tela.

A raiz do problema está em dois pontos:

1. **Container pai com `w-96` fixo + inner `div` também com `w-96`** no `Inbox.tsx` (linha 274): o container externo tem `overflow-hidden`, mas o interno não tem restrição de largura relativa.

2. **`ScrollArea` não restringe largura dos filhos**: O `ScrollAreaPrimitive.Viewport` usa `w-full` mas herda do pai que pode expandir. Os filhos como `LeadFieldsSection` e `ContactFieldsSection` têm elementos com larguras fixas (inputs, botões de edição) que podem ultrapassar o container.

## Plano de Correção

### 1. Corrigir container no `Inbox.tsx`
- Trocar `<div className="w-96 h-full">` por `<div className="w-96 h-full min-w-0 overflow-hidden">` para garantir que o conteúdo interno nunca extrapole.

### 2. Corrigir `RightSidePanel.tsx`
- Adicionar `overflow-hidden` ao `ScrollArea` para reforçar contenção horizontal.

### 3. Corrigir `LeadFieldsSection.tsx` e `ContactFieldsSection.tsx`
- Adicionar `min-w-0 overflow-hidden` ao container raiz (`<div className="p-4 space-y-2">`) de ambos.
- Nos campos de edição inline, garantir que inputs e botões usem `min-w-0` e `overflow-hidden` para não expandir além do container.
- Reduzir largura dos inputs de edição de `w-40` para `w-32` ou usar `flex-1 min-w-0` para que se adaptem.

### 4. Corrigir `LeadPanelTabs.tsx`
- Já está com `overflow-hidden` no container externo e `overflow-x-auto` no interno -- sem alteração necessária.

### Resumo das alterações
- `src/pages/Inbox.tsx` -- adicionar `min-w-0 overflow-hidden` no wrapper interno
- `src/components/inbox/RightSidePanel.tsx` -- `overflow-hidden` no ScrollArea
- `src/components/inbox/lead-panel/LeadFieldsSection.tsx` -- `min-w-0 overflow-hidden` no container + ajustar inputs
- `src/components/inbox/lead-panel/ContactFieldsSection.tsx` -- mesmas correções

