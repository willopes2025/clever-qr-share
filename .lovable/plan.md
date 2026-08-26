# Status dos pedidos + configuração restrita a administradores

## Diagnóstico (verificado nos dados reais)

O campo `status` que o ERP devolve no feed de pedidos **não é o status comercial** — é o status de separação. Contagem real dos pedidos já sincronizados:

```text
CONFERIDO             659
AGUARDANDO SEPARAÇÃO  242
(vazio)                15
SEPARADO                2
```

Ou seja: não existe "faturado", "cancelado" ou "entregue" nesse campo — por isso a coluna parece quebrada. A informação real está em outros lugares do mesmo registro:

- **Faturamento**: `nfe_numero` / `nfe_chave` / `dtemisdocfiscal` preenchidos = pedido faturado.
- **Cancelamento**: só aparece no item, em `statusitempedido`:
  - `ITA - ITEM TOTALMENTE ATENDIDO` (1.622)
  - `IAP - ITEM AGUARDANDO PROCESSAMENTO` (751)
  - `ITCD - ITEM TOTALMENTE CANCELADO DEVOLVIDO` (39)

Sobre a configuração: hoje o botão "Configurações" da aba Orçamentos aparece para qualquer usuário, e as regras do banco (`gestao_parts_orcamento_config`, `gestao_parts_vendedores`) liberam gravação para qualquer usuário autenticado.

## Correções

### 1. Duas informações distintas em vez de uma coluna confusa
- Coluna **Situação** (comercial), calculada nesta ordem:
  1. `CANCELADO` — todos os itens com `ITCD`, ou flag/data de cancelamento no cabeçalho.
  2. `PARCIALMENTE CANCELADO` — parte dos itens com `ITCD`.
  3. `FATURADO` — tem NF-e emitida.
  4. `EM ANDAMENTO` — itens ainda em `IAP`.
  5. `ATENDIDO` — todos os itens em `ITA` sem NF-e.
- Coluna **Separação**: mostra o valor cru do ERP (`AGUARDANDO SEPARAÇÃO`, `SEPARADO`, `CONFERIDO`, ou "—" quando vazio), como etiqueta neutra.
- Cores: vermelho para cancelado, âmbar para parcial, verde para faturado/atendido, cinza para em andamento.
- Mesmo cálculo aplicado no detalhe do pedido e no resumo do card do lead, para não haver divergência entre telas.

### 2. Filtro de status utilizável
O filtro rápido atual ("Somente cancelados / Ocultar cancelados") passa a ser um seletor de situação: Todos · Cancelados · Parcialmente cancelados · Faturados · Em andamento, mais um seletor separado de separação.

### 3. Configuração só para administradores
- O botão "Configurações" (Envio + Vendedores) só é renderizado quando `useAdmin().isAdmin` for verdadeiro; usuário sem permissão nem vê o acesso.
- Dentro dos cards de Envio e Vendedores, campos e botões de gravar ficam desabilitados para não-admin (defesa em profundidade).
- No banco: substituir as regras permissivas por regras que exigem papel de administrador para alterar a configuração de envio e o mapeamento de vendedores; a leitura continua liberada para os usuários autenticados da organização (o vendedor precisa ler o próprio vínculo).

## Detalhes técnicos
- Arquivos: `src/components/gestao-parts/PedidosTable.tsx` (cálculo de situação/separação, colunas e filtros), `src/components/gestao-parts/utils.ts` (helper compartilhado `situacaoPedido`), `src/pages/GestaoParts.tsx` (gate de admin), `src/components/gestao-parts/OrcamentoAutoCard.tsx` e `VendedoresMappingCard.tsx` (campos somente leitura para não-admin).
- Uma migração ajusta as políticas de `gestao_parts_orcamento_config` e `gestao_parts_vendedores` para escrita apenas por administrador (`has_role(auth.uid(),'admin')`).
- Nenhuma alteração no fluxo de sincronização/disparo; as automações do funil permanecem desativadas.
