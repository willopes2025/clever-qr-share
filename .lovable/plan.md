## Problemas identificados

### 1. Não é possível unir leads na visão de Lista do funil
Ao selecionar 2+ leads, o botão **"Unir Leads"** aparece e ao clicar chama `setMergeDialogOpen(true)`, mas o componente `<MergeDealsDialog>` **nunca é renderizado** no JSX de `FunnelListView.tsx` (apenas o estado e o import existem). Por isso nada acontece ao clicar. Na visão Kanban funciona porque lá o dialog está montado.

### 2. Não há ordenação alfabética / crescente / decrescente
Os cabeçalhos das colunas só abrem popover de filtro. Não existe estado nem UI de sort em `FunnelListView.tsx`.

---

## Solução

### A) Renderizar o `MergeDealsDialog` na Lista (`src/components/funnels/FunnelListView.tsx`)

Adicionar, junto aos outros dialogs no final do componente:

```tsx
<MergeDealsDialog
  open={mergeDialogOpen}
  onOpenChange={setMergeDialogOpen}
  deals={filteredDeals.filter(d => selectedIds.includes(d.id))}
  funnel={funnel}
  onMerged={() => setSelectedIds([])}
/>
```

Resultado: ao selecionar 2+ leads e clicar **"Unir Leads"**, o diálogo abrirá normalmente, permitindo escolher o lead principal, a etapa final e a origem de cada campo (igual ao Kanban).

### B) Adicionar ordenação por coluna (`FunnelListView.tsx`)

1. Novo estado:
   ```ts
   const [sortConfig, setSortConfig] = useState<{ columnId: string; direction: 'asc' | 'desc' } | null>(null);
   ```

2. Função `toggleSort(columnId)` que alterna entre `asc → desc → null` (sem ordenação).

3. No `useMemo` de `filteredDeals`, aplicar `.sort(...)` final usando `getCellValue(deal, columnId)` já existente. Para colunas numéricas (`value`) e de data (`expected_close`, `time_in_stage`, custom date) usar comparação numérica/Date; para o resto, comparação de string com `localeCompare(... , 'pt-BR', { sensitivity: 'base', numeric: true })`. Valores `"-"` / vazios vão sempre para o final.

4. Atualizar `renderColumnHeader`: adicionar botões **"Ordenar A→Z"** e **"Ordenar Z→A"** dentro do `PopoverContent` (acima do filtro). Mostrar uma seta (`ArrowUp`/`ArrowDown`) ao lado do nome da coluna no header quando ela for a coluna ativa do sort.

5. Quando `sortConfig` está ativo, a paginação visível continua a mesma (a ordenação acontece sobre os deals já carregados — coerente com o comportamento atual de filtros).

---

## Arquivos alterados
- `src/components/funnels/FunnelListView.tsx` — montar `MergeDealsDialog` + adicionar lógica/UI de sort por coluna.

Nenhuma migration ou novo arquivo necessário.