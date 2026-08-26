# Destaque visual para pedidos cancelados

Hoje o status do pedido aparece como uma etiqueta cinza igual para todos os casos — um pedido cancelado fica visualmente idêntico a um pedido normal, então é fácil passar despercebido.

## O que será feito

Na tabela de pedidos (aba Pedidos da Gestão Parts e também no card do lead no Inbox, que usa a mesma tabela):

- Etiqueta de status colorida: vermelho para cancelado, verde para faturado/concluído, cinza para os demais.
- Linha inteira do pedido cancelado com fundo avermelhado suave, número do pedido riscado e ícone de alerta antes do status.
- Valor total do pedido cancelado exibido em tom apagado/riscado, para não ser somado mentalmente como venda válida.
- No painel de detalhes (a gaveta que abre ao clicar no pedido), uma faixa de aviso no topo: "Pedido cancelado".
- Filtro rápido acima da tabela: "Todos / Somente cancelados / Ocultar cancelados".

## Detalhes técnicos

- `src/components/gestao-parts/PedidosTable.tsx`: nova função auxiliar que classifica o status normalizado (remove acentos/caixa) em `cancelado | faturado | outro`, cobrindo variações do ERP (`CANCELADO`, `CANCELADA`, `PEDIDO CANCELADO`, campo `dtcancelamento`/`cancelado` quando presente).
- Estilos usando apenas tokens semânticos (`destructive`, `muted`) — nada de cores fixas.
- Estado local para o filtro de cancelados, aplicado junto com a busca existente (`filterRecords`).
- Sem mudanças em banco de dados ou edge functions.
