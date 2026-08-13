# Exclusão em massa: Listas, Templates e Disparos

Adicionar seleção múltipla com exclusão em lote nas três telas.

## Como vai funcionar (igual nas três telas)

- Checkbox em cada item (card e visão em lista).
- Barra de ações aparece quando há 1+ selecionados, mostrando "N selecionados", botão "Selecionar todos" / "Limpar seleção" e botão "Excluir selecionados".
- Diálogo de confirmação informando a quantidade e que a ação é irreversível.
- Exclusão em lotes (50 por vez) com toast de progresso e resumo final (X excluídos, Y com erro).
- Seleção é limpa após concluir e respeita os filtros/busca ativos (selecionar todos = todos os itens visíveis).

## Telas afetadas

1. Listas de Transmissão (`/listas`) — cards e visão em tabela.
2. Templates (`/templates`) — cards e visão em lista.
3. Campanhas / Disparos — cards de campanha.

## Detalhes técnicos

- Novo hook `src/hooks/useBulkSelection.ts` (estado de IDs selecionados, toggle, selectAll, clear) e componente `src/components/shared/BulkActionsBar.tsx` reutilizável.
- Hooks de dados ganham mutação em lote:
  - `useBroadcastLists.ts`: `deleteLists(ids)` — remove vínculos em `broadcast_list_contacts` e depois `broadcast_lists`.
  - `useMessageTemplates.ts`: `deleteTemplates(ids)`.
  - `useCampaigns.ts`: `deleteCampaigns(ids)` — remove `campaign_messages` e depois `campaigns`.
  - Todas usando `.in('id', chunk)` em blocos de 50 e invalidando as queries ao final.
- Componentes `BroadcastListCard`, `BroadcastListListView`, `TemplateCard`, `TemplateListItem` e `CampaignCard` recebem props opcionais `selected` / `onSelectChange` para renderizar o checkbox sem quebrar usos existentes.
- Estilo com tokens semânticos existentes (sem cores fixas), compatível com tema claro/escuro.
