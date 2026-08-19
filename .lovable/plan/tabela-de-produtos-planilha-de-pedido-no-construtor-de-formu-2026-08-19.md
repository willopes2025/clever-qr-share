# Tabela de Produtos (planilha de pedido) no construtor de formulários

Novo tipo de campo "Tabela de Produtos" onde você cadastra o catálogo (produto + preço de custo) e quem preenche o formulário informa apenas a quantidade. O total do pedido é calculado ao vivo e vai para o valor do lead no CRM.

## Como vai funcionar

No construtor (aba Campos):
- Novo item na paleta, categoria "Especiais": **Tabela de Produtos**.
- No painel de propriedades, uma lista editável de produtos com: nome, unidade/descrição opcional e **preço de custo**.
- Opções: permitir quantidade zero (padrão sim), quantidade máxima por item, e rótulo do total ("Total do pedido").
- Prévia no canvas mostrando a tabela com colunas Produto | Preço | Qtd | Subtotal e a linha de Total.

No formulário público:
- Tabela com os produtos cadastrados, campo de quantidade em cada linha.
- Subtotal por linha e **Total geral** recalculados a cada digitação.
- Apenas o preço de custo aparece (não existe preço de venda).
- Se o campo for obrigatório, exige pelo menos um item com quantidade maior que zero.

Nas respostas e no CRM:
- A resposta guarda a lista de itens pedidos (produto, preço, quantidade, subtotal) e o total.
- O total preenche automaticamente o valor do negócio (deal), como já acontece com o campo "Valor da Venda".
- Na aba Respostas, a coluna mostra o total e o detalhe dos itens ao abrir a resposta.

## Detalhes técnicos

- Novo `field_type: 'product_table'`, sem migração de banco: o catálogo é salvo em `form_fields.settings.products` (`[{ id, name, unit, cost_price }]`) mais `settings.total_label`, `settings.max_quantity`, `settings.maps_to_deal_value`.
- `FieldPalette.tsx`: nova entrada com ícone de tabela.
- `FieldProperties.tsx`: editor de linhas do catálogo (adicionar/remover/reordenar, preço em BRL com máscara), com IDs únicos por produto (mesmo cuidado já aplicado às opções para evitar colisão).
- `FieldPreview.tsx`: render estático da tabela com totais de exemplo.
- `supabase/functions/public-form/index.ts`: novo `case 'product_table'` no gerador de HTML, com inputs `data-price` por linha, script de recálculo de subtotais/total e um `input hidden` com o JSON dos itens + total enviado no submit.
- Handler de submissão do `public-form`: interpretar o JSON, gravar em `form_submissions.data` e, quando `maps_to_deal_value` estiver ativo, usar o total como `funnel_deals.value` (mesmo caminho já usado por `deal_value`).
- `SubmissionsList` / detalhe da resposta: formatar o campo como tabela de itens + total em BRL.
- Valores monetários tratados em centavos internamente para evitar erro de arredondamento; exibição em `pt-BR`.

## Fora do escopo
- Preço de venda, margem ou lucro.
- Catálogo compartilhado entre formulários (o catálogo é por campo).
