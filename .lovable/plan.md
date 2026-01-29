
Objetivo
- Fazer o “card/dialog” de criação de lista (“Nova Lista de Transmissão”) exibir rolagem vertical de forma confiável quando o conteúdo (especialmente “Critérios de Filtro”) ultrapassar a altura disponível, e deixar a barra visível/óbvia.

O que está acontecendo hoje (com base no código e no seu print)
- O conteúdo “Critérios de Filtro” está sendo cortado dentro do diálogo, sem uma barra de rolagem visível para acessar o restante.
- O layout atual tenta usar um ScrollArea no meio do diálogo, mas a rolagem/barra não está aparecendo como esperado.

Causas mais prováveis (técnico)
1) O DialogContent base (shadcn/radix) já vem como `grid`. No nosso componente, estamos tentando transformá-lo em `flex flex-col`. Dependendo da ordem/precedência do CSS do Tailwind, pode ficar “grid” mesmo, o que faz `flex-1` não funcionar e a área “scrollável” não ganhar altura. Resultado: o conteúdo extrapola e é cortado.
2) O ScrollArea do Radix, por padrão, pode esconder a scrollbar e só exibir no hover (comportamento “hover”), o que faz parecer “sem barra”, principalmente em touch/mobile.

Abordagem de correção (robusta e alinhada com padrões do projeto)
- Trocar o layout do diálogo para um grid com linhas fixas para cabeçalho/rodapé e uma linha central “1fr” scrollável, igual ao padrão já usado em `ImportContactsDialogV2`.
- Configurar a área do meio para ter `min-h-0` (essencial para permitir que a área encolha e possa rolar).
- Forçar a scrollbar do Radix ScrollArea a ficar visível (não só no hover), usando `type="always"` e `scrollHideDelay={0}`.

Mudanças propostas (passo a passo)
1) Ajustar layout do diálogo para grid com linha scrollável
   - Arquivo: `src/components/broadcasts/BroadcastListFormDialog.tsx`
   - Alterar o `DialogContent` para:
     - Remover dependência de `flex flex-col`.
     - Usar: `grid grid-rows-[auto_1fr_auto]` + `max-h-[85vh]` + `overflow-hidden`.
     - Manter o `DialogHeader` na primeira linha e o `DialogFooter` na última.

2) Garantir que a área central realmente possa rolar
   - No componente central (onde está o `<ScrollArea>`):
     - Remover `flex-1` (não será mais necessário).
     - Manter/adicionar `min-h-0` (crítico em grid).
     - Manter o form dentro da área rolável.

3) Tornar a barra visível (não depender de hover)
   - Ainda em `BroadcastListFormDialog.tsx`, ajustar o `<ScrollArea>`:
     - Passar props para o Radix Root (já suportado pelo wrapper): `type="always"` e `scrollHideDelay={0}`.
     - Opcional: adicionar `className="touch-pan-y overscroll-contain"` para melhorar scroll em touch.

4) (Opcional, se a barra ainda estiver “muito discreta”) Melhorar contraste da scrollbar
   - Arquivo: `src/components/ui/scroll-area.tsx`
   - Ajustar estilos do `ScrollAreaThumb` (ex.: `bg-muted-foreground/40 hover:bg-muted-foreground/60`) e/ou adicionar um fundo leve no trilho.
   - Observação: isso impacta todas as ScrollAreas do app. Só faremos se você quiser uma barra mais evidente em toda a aplicação.

Como vou validar (checklist)
- Abrir /broadcast-lists → “Nova Lista de Transmissão”.
- Selecionar “Dinâmica”.
- Confirmar que:
  - A área do meio rola com mouse wheel/trackpad/toque.
  - A barra vertical aparece visivelmente (sem precisar hover).
  - O rodapé com “Cancelar / Criar Lista” permanece fixo e acessível.
- Testar em viewport menor (modo mobile) para garantir que o scroll funciona quando “Critérios de Filtro” fica grande.

Arquivos que serão modificados
- Obrigatório:
  - `src/components/broadcasts/BroadcastListFormDialog.tsx`
- Opcional (se precisar reforçar a visibilidade global da barra):
  - `src/components/ui/scroll-area.tsx`
