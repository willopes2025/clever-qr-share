# Nota fiscal no pedido: chave, link de consulta e PDF (DANFE)

## O que já temos (verificado nos dados reais)

Cada pedido faturado traz, no próprio retorno do ERP, os dados fiscais completos:

- `nfe_numero` (ex.: 059876), `nfe_serie` (1)
- `nfe_chave` — chave de acesso de 44 dígitos (ex.: `32260859336127000129550010000598761009550684`)
- `dtemisdocfiscal` / `hremisdocfiscal`

Hoje a integração **não** possui nenhuma rota de DANFE/XML: nada em `gestao-parts-api` busca nota fiscal. Ou seja, a chave existe, mas o PDF ainda não.

## Como fica

### 1. Bloco "Nota fiscal" no detalhe do pedido (entrega garantida)
No pop-up do pedido, quando houver NF-e:
- Número / série / data de emissão.
- Chave de acesso formatada em grupos de 4, com botão "Copiar chave".
- Botão "Consultar na SEFAZ" abrindo o Portal Nacional da NF-e em nova aba (a consulta pública por chave exige o captcha do portal, então a chave já vai copiada para colar).
- A mesma chave/ações aparecem na listagem via um ícone discreto na linha dos pedidos faturados.

Isso funciona só com o que o ERP já devolve, sem depender de rota nova.

### 2. PDF da DANFE — depende de rota do ERP (a confirmar)
Primeiro passo da implementação: sondar o ERP nas rotas candidatas de documento fiscal (`/erpssplus/nfe/danfe`, `/erpssplus/v2/nfe/{chave}`, `/erpssplus/pedido/danfe`, variantes de XML) usando um pedido faturado real, e registrar exatamente o que responde.

Resultados possíveis e o que faremos em cada um:

- **O ERP devolve PDF (ou URL do PDF)**: nova ação `nfe_danfe` na função `gestao-parts-api` que recebe a chave/pedido e retorna o arquivo; no pop-up aparece o botão "Baixar DANFE (PDF)", abrindo em nova aba.
- **O ERP devolve apenas o XML**: a função guarda o XML e geramos o DANFE em PDF a partir dele (layout padrão: emitente, destinatário, itens, totais, chave e código de barras), entregue pelo mesmo botão.
- **O ERP não expõe nada**: mantemos apenas a etapa 1 (chave + consulta na SEFAZ) e informo isso claramente, sem inventar link que não funciona. Nesse caso, o caminho seria pedir ao suporte da Gestão Parts a liberação do endpoint de documento fiscal.

## Detalhes técnicos
- `supabase/functions/gestao-parts-api/index.ts`: nova ação `nfe_danfe` (autenticada, mesma resolução de credenciais por organização), retornando `{ pdf_base64 }` ou `{ url }`.
- `src/components/gestao-parts/PedidosTable.tsx`: bloco "Nota fiscal" no `Sheet`, formatação da chave, copiar, link SEFAZ e botão de download condicionado à disponibilidade da rota.
- `src/hooks/useGestaoParts.ts`: nova ação no tipo `GestaoPartsAction`.
- Sem migração de banco; nada é armazenado — o PDF é buscado sob demanda.
