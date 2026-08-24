# Aba Pedidos: tabela enxuta, detalhe em pop-up e busca local

Objetivo: deixar a aba Pedidos com a mesma experiência já validada na aba Peças — listagem com poucas colunas legíveis, clique na linha abrindo um pop-up que carrega os detalhes sob demanda (com loading), e um campo de busca que filtra os resultados já carregados.

## Estado atual (verificado)

- `list_pedidos` chama `/erpssplus/v3/pedido/feed` e devolve `{ items, totalblocos, blocoatual }` (`supabase/functions/gestao-parts-api/index.ts`).
- A aba Pedidos ainda renderiza a tabela genérica (`GestaoPartsTable`), que infere colunas do JSON e não formata valores nem abre detalhe.
- Já existem no backend `get_pedido_status` (`/erpssplus/v2/pedido/status`) e `get_pedido` (`/erpssplus/pedido/requisicao`), mas nenhuma rota que traga os **itens** do pedido está confirmada hoje.

Primeiro passo da implementação: inspecionar um item real do feed v3 e a resposta de `pedido/status` para mapear os nomes exatos dos campos (número, data, cliente, total, status, NF-e) e descobrir se os itens do pedido vêm no próprio feed, em `pedido/status`, ou em rota dedicada da doc do ERP. O mapeamento abaixo usa fallback de chaves (como já é feito em Peças) para não quebrar caso a nomenclatura varie.

## O que será feito

### 1. Novo componente `PedidosTable.tsx`
Espelha `PecasTable.tsx`:
- Colunas básicas: Nº do pedido, Data/hora, Tipo, Cliente, Status, Total (formatado em BRL).
- Linha clicável → abre `Sheet` com skeleton de carregamento e, ao concluir, exibe campos formatados:
  - Cabeçalho: número, tipo, data, status, empresa, NF-e.
  - Cliente: nome, documento, vendedor.
  - Totais: subtotal, desconto, frete, total.
  - **Itens do pedido**: tabela com código, descrição, quantidade, valor unitário e valor total do item.
  - Pagamento/entrega quando existirem no retorno.
- Botão "Ver JSON" mantido como fallback de diagnóstico.
- Helpers reaproveitados (`money`, `text`, `num`, `pick`, `toRecords`) extraídos para `src/components/gestao-parts/utils.ts` para não duplicar código entre Peças e Pedidos.

### 2. Busca local nos resultados
Componente compartilhado de filtro (input com ícone de lupa) aplicado sobre a lista já carregada:
- Normaliza acentos e caixa; casa com qualquer campo textual/numérico do registro (número, cliente, status, valor).
- Mostra "X de Y registros" e estado vazio próprio ("Nenhum registro corresponde a ...").
- Aplicado à aba Pedidos e, pela mesma via, à tabela de Peças (mesmo componente).
- Filtra apenas o bloco atual — a paginação por bloco do ERP continua igual.

### 3. Detalhe sob demanda no backend
- Nova ação `pedido_detalhe` em `gestao-parts-api` que, dado o número/token do pedido, consolida em um único retorno: dados do cabeçalho (`/erpssplus/v2/pedido/status`) + itens (rota confirmada na etapa de inspeção; se o feed v3 já trouxer os itens, o detalhe usa o próprio registro e evita chamada extra).
- Retorno padronizado `{ pedido, itens, totais }` para o frontend não precisar adivinhar formato.
- Erros do ERP propagados com a mensagem exata, exibidos no pop-up.

### 4. Ajuste em `GestaoParts.tsx`
- Aba Pedidos passa a usar `PedidosTable` em vez da tabela genérica, mantendo filtros de período, tipos e paginação por bloco.
- Campo de busca posicionado acima da tabela, junto ao contador de resultados.

## Detalhes técnicos
- Arquivos: `src/components/gestao-parts/PedidosTable.tsx` (novo), `src/components/gestao-parts/ResultSearch.tsx` (novo), `src/components/gestao-parts/utils.ts` (novo), `src/components/gestao-parts/PecasTable.tsx`, `src/pages/GestaoParts.tsx`, `src/hooks/useGestaoParts.ts`, `supabase/functions/gestao-parts-api/index.ts`.
- Sem migração de banco; credenciais e `base_url` seguem na tabela de integrações por organização.
- Filtro é client-side (não gera chamadas ao ERP); busca por número específico continua disponível pela consulta de status.
