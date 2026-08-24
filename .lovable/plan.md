# Aba Peças: retorno legível em vez de texto cru e base64

O que a tela mostra hoje vem da rota `POST /erpssplus/peca` ("Verificar a existência da peça"), que devolve só três campos: `apresenta` (uma frase única com código, marca, descrição, quantidade e preço juntos), `img` e `imgbase64` (a imagem inteira em texto). Por isso a tabela aparece com uma coluna gigante de base64 e nada de estruturado.

Testei o servidor do Martins e confirmei uma rota melhor para catálogo: `GET /erpssplus/peca/dados` (paginada por `bloco`), que retorna campos separados: `codigo`, `descricao`, `marca`, `grupo`, `subgrupo`, `secao`, `codigofabricante`, `codigobarras`, `unidadesaida`, `status`, `fornecedores`, `aplicacao`, `datacadastro` — com `totalblocos`/`blocoatual` (31 blocos na base atual).

## O que será feito

### Backend (`gestao-parts-api`)
- Nova ação `peca_dados` usando `GET /erpssplus/peca/dados` com `bloco` (>=1), e filtros opcionais `codigo`, `marca`, `grupo`, `subgrupo`, `secao`, `habilitadoecommerce`, `dtatualizacao`; resposta padronizada em `{ items, totalblocos, blocoatual }`.
- Manter `search_peca` (`POST /erpssplus/peca`) apenas como "busca rápida por descrição/veículo/código de barras", mas com parsing do campo `apresenta` em colunas: código, marca, descrição, quantidade e preço; e devolver a imagem como `imagem` (data URI) em vez de texto solto.
- Enriquecimento opcional por linha selecionada: preço (`/erpssplus/peca/preco/{codigoerp}`) e estoque (`/erpssplus/v2/peca/estoque/atual/{codigoerp}`).

### Frontend (aba Peças)
- Tabela dedicada de peças (não mais a tabela genérica): colunas Código, Descrição, Marca, Un., Qtd., Preço e miniatura da imagem — sem nunca renderizar base64 como texto.
- Dois modos de busca: "Busca rápida" (descrição / código de fabricante / código de barras / placa) e "Catálogo" (rota de dados, com paginação por bloco e filtros de marca/grupo).
- Clique na linha abre um painel lateral com detalhes: preço por tabela, estoque atual/reservado/em trânsito, fornecedores, aplicação e imagem ampliada.
- Estados de vazio/erro com a mensagem exata do ERP; botão "Ver JSON" mantido para depuração.

## Detalhes técnicos
- Arquivos: `supabase/functions/gestao-parts-api/index.ts`, `src/hooks/useGestaoParts.ts`, `src/pages/GestaoParts.tsx`, novo `src/components/gestao-parts/PecasTable.tsx` (+ sheet de detalhe).
- Sem migração de banco; credenciais e `base_url` continuam na integração da organização.
- `imgbase64` vira `src="data:image/jpeg;base64,..."`, nunca coluna de texto.
