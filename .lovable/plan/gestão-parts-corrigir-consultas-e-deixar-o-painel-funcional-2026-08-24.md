# Gestão Parts: corrigir consultas e deixar o painel funcional

Testei a API real do servidor do Martins (`http://189.50.8.166:32150`) com as credenciais atuais e comparei com a documentação oficial (GPASI v4.0.31). O problema não é a data: é o endpoint e a paginação que estamos usando.

## O que descobri nos testes reais

1. **Pedidos sempre voltando 1 registro** — usamos `/erpssplus/v2/pedido/status`, que nessa versão do ERP devolve **apenas 1 pedido** (o último do período), qualquer que seja o filtro:
   - 01/07 a 31/07 → 1 pedido (767539)
   - 01/08 a 24/08 → 1 pedido (770851)
   - 01/01 a 31/12/2026 → 1 pedido
   Essa rota é de *consulta de status de um pedido*, não de listagem.
2. **Existe a rota certa de listagem: `/erpssplus/v3/pedido/feed`** — testada e funcionando, retornou 6 blocos de pedidos E-COMMERCE em agosto. Exige:
   - `bloco` começando em **1** (não 0);
   - `tipopedido` em **maiúsculas e sem acento**: `ORCAMENTO`, `CONDICIONAL`, `PRE-VENDA`, `E-COMMERCE` (com "Orçamento"/"E-commerce" a API devolve 500 ou mensagem de erro);
   - `dtinicio`/`dtfinal` no formato `AAAA-MM-DD`.
   Retorna `{ totalblocos, blocoatual, pedidos: [...] }`.
3. **Clientes e Financeiro voltavam vazios pelo mesmo motivo: `bloco: 0`.** Nossa função envia 0; a API só responde com `bloco >= 1`.
   - `/erpssplus/cliente` com `bloco:1` → 97 blocos de clientes.
   - `/erpssplus/financeiro/contas/receber` com `bloco:1` → 6/8 blocos de duplicatas, com valor, vencimento, cliente, vendedor e pagamentos.
4. **Peças por placa** está sendo enviada como query string, mas a API espera `placa` no **corpo** da requisição.
5. `/erpssplus/pedido/requisicao` e `/pedido/requisicao/cpf` respondem "Pedido não encontrado" para pedidos normais de balcão — servem só para E-Commerce/Condicional/Pré-venda, então viram consulta secundária.

## O que será implementado

### Edge function `gestao-parts-api`
- Nova ação `list_pedidos` usando `/erpssplus/v3/pedido/feed` com `bloco`, `tipopedido` (normalizado para maiúsculo sem acento), `dtinicio`, `dtfinal`, `empresa` e `status`; retorna também `totalblocos`/`blocoatual` para paginação.
- Manter `/erpssplus/v2/pedido/status` apenas como ação `get_pedido_status` (consulta por número de pedido ou token) e `get_pedido` por requisição.
- Corrigir `bloco` padrão para **1** em `list_clientes`, `contas_receber`, `peca_tabela_preco` e `peca_preco` (lista), validando `bloco >= 1`.
- Enviar `placa` no corpo em `peca_veiculo_placa`.
- Normalizar datas: aceitar `DD/MM/AAAA` da UI e converter para `AAAA-MM-DD` antes de chamar o ERP.
- Padronizar o retorno das rotas paginadas em `{ items, totalblocos, blocoatual }` para o frontend não precisar adivinhar o formato.
- `lead_summary` passa a usar o feed v3 (filtrando pelo `codpessoa` do cliente encontrado) + contas a receber com `bloco:1`.

### Página "Gestão Parts" (frontend)
- **Aba Pedidos**: filtro de período (padrão últimos 30 dias), seletor de tipo de pedido (multi-seleção com os 4 tipos válidos), empresa (0001 MARTINS AUTO PEÇAS / 0002 MARTINS DISTRIBUIDORA, carregadas de `empresa/status`) e status de separação. Tabela com nº do pedido, data/hora, cliente, total, status, NF-e; paginação por bloco mostrando "bloco X de Y"; clique na linha abre detalhe do pedido.
- **Aba Clientes**: busca por CPF/CNPJ/código, situação (ativos/inativos/todos) e paginação por bloco, exibindo total de blocos.
- **Aba Financeiro**: filtro por emissão ou vencimento, empresa e cliente; colunas de duplicata, emissão, vencimento, cliente, valor, valor em aberto e forma de pagamento; destaque para títulos em aberto; ação de buscar boletos por empresa+planilha.
- **Aba Peças**: busca por descrição/código/código de barras/placa (placa passando a funcionar), com preço e estoque por empresa.
- Estados de vazio/erro explícitos com a mensagem exata do ERP e indicação de paginação.

### Painel no card do lead
- Usa o feed v3 filtrado pelo cliente e as contas a receber com paginação correta, mostrando os últimos pedidos e títulos em aberto.

## Detalhes técnicos
- Arquivos: `supabase/functions/gestao-parts-api/index.ts`, `src/hooks/useGestaoParts.ts`, `src/pages/GestaoParts.tsx`, `src/components/gestao-parts/*`, `src/components/funnels/GestaoPartsDealSection.tsx`.
- Nenhuma migração de banco; credenciais e `base_url` continuam na tabela de integrações por organização.
- Todos os endpoints do GPASI usam **GET com corpo JSON** — a chamada raw atual já suporta isso e será mantida.
