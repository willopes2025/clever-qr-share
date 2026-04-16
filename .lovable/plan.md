

# Unificar Leads no Funil (Merge Deals)

## Problema
Atualmente, a unificação só existe para conversas no Inbox. Quando um contato tem múltiplos leads (deals) em funis diferentes, não há como unificá-los pela interface do funil.

## Solução
Adicionar uma opção "Unificar com outro lead" no menu de contexto do card do lead (Kanban e ListView). Ao clicar, abre um dialog com:

1. **Etapa 1 — Busca**: Campo de busca por nome/telefone que lista todos os deals encontrados, mostrando o nome do contato, funil e etapa de cada um. O usuário seleciona o lead duplicado.

2. **Etapa 2 — Comparação de campos**: Reutiliza o componente `MergeFieldComparison` existente, mas adaptado para comparar os campos do **deal** (título, valor, notas, responsável, custom_fields do deal) além dos campos do contato. O usuário clica no valor que quer manter.

3. **Unificação**: O lead mantido recebe os campos selecionados. O lead duplicado é excluído. Se os contatos forem diferentes, os dados do contato também são mesclados (como já funciona no Inbox). Tarefas e histórico de movimentação do lead excluído são transferidos para o lead mantido.

## Componentes

### Novo: `MergeDealsDialog.tsx`
- Props: `dealId`, `open`, `onOpenChange`, `onMerged`
- Etapa "select": input de busca que consulta `funnel_deals` com join em `contacts` e `funnel_stages`/`funnels`. Exibe cards com nome, telefone, funil e etapa.
- Etapa "compare": mostra campos do deal (título, valor, fonte, notas, responsável, custom_fields) + campos do contato. Reutiliza lógica de `buildFieldRows`/`getAutoSelections`.
- Ao confirmar: atualiza o deal mantido com os campos selecionados, transfere tarefas (`deal_tasks`) e histórico (`deal_stage_history`), deleta o deal duplicado. Se contatos diferentes, mescla dados do contato.

### Modificado: `FunnelDealCard.tsx`
- Adiciona item "Unificar com outro lead" no DropdownMenu (com ícone `Merge`)
- Renderiza `MergeDealsDialog`

### Modificado: `FunnelListView.tsx`
- Adiciona a mesma opção de unificação no menu de contexto da listagem

## Fluxo técnico da unificação

```text
1. Atualiza deal mantido com campos selecionados (título, valor, notas, custom_fields, etc.)
2. UPDATE deal_tasks SET deal_id = keepDealId WHERE deal_id = mergeDealId
3. UPDATE deal_stage_history SET deal_id = keepDealId WHERE deal_id = mergeDealId
4. Se contatos diferentes: atualiza contato mantido com campos selecionados
5. DELETE funnel_deals WHERE id = mergeDealId
6. Invalida queries do React Query
```

Nenhuma migração de banco é necessária — tudo usa tabelas e campos já existentes.

