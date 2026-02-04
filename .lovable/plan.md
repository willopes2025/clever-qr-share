
# Correção: Loop Infinito no FunnelListView

## Problema Identificado

O componente `FunnelListView.tsx` está reiniciando constantemente devido a um **uso incorreto de `useMemo`** que causa um loop infinito de renderização.

### Código Problemático (Linhas 163-170)

```typescript
// ❌ ERRADO - useMemo NÃO deve ter efeitos colaterais
useMemo(() => {
  const allIds = allColumns.map((c) => c.id);
  const newIds = allIds.filter((id) => !columnOrder.includes(id));
  if (newIds.length > 0) {
    setColumnOrder((prev) => [...prev, ...newIds]); // setState dentro de useMemo!
  }
}, [allColumns, columnOrder]);
```

### Por Que Isso Causa Loop Infinito

| Passo | O que acontece |
|-------|----------------|
| 1 | `useMemo` executa e chama `setColumnOrder()` |
| 2 | React agenda uma re-renderização devido à mudança de estado |
| 3 | Componente re-renderiza |
| 4 | `useMemo` executa novamente (nova referência de `allColumns`) |
| 5 | Se houver diferença, chama `setColumnOrder()` de novo |
| 6 | Ciclo se repete indefinidamente |

### Regra Violada

**`useMemo` é para computação pura** - nunca deve ter efeitos colaterais como:
- Chamadas de `setState`
- Requisições HTTP
- Modificação de variáveis externas
- `console.log` em produção

---

## Solução

Substituir o `useMemo` por `useEffect`, que é o hook correto para sincronização e efeitos colaterais.

### Código Corrigido

```typescript
// ✅ CORRETO - useEffect para efeitos colaterais
useEffect(() => {
  const allIds = allColumns.map((c) => c.id);
  const newIds = allIds.filter((id) => !columnOrder.includes(id));
  if (newIds.length > 0) {
    setColumnOrder((prev) => [...prev, ...newIds]);
  }
}, [allColumns]); // ← Remover columnOrder das dependências para evitar loop
```

### Mudanças Principais

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Hook usado | `useMemo` | `useEffect` |
| Dependências | `[allColumns, columnOrder]` | `[allColumns]` |
| Comportamento | Loop infinito | Executa apenas quando allColumns muda |

---

## Arquivo a Modificar

| Arquivo | Linha | Alteração |
|---------|-------|-----------|
| `src/components/funnels/FunnelListView.tsx` | 163-170 | Substituir `useMemo` por `useEffect` |

---

## Seção Técnica

### Migração Completa

De:
```typescript
// Sync column order when new custom fields are added
useMemo(() => {
  const allIds = allColumns.map((c) => c.id);
  const newIds = allIds.filter((id) => !columnOrder.includes(id));
  if (newIds.length > 0) {
    setColumnOrder((prev) => [...prev, ...newIds]);
  }
}, [allColumns, columnOrder]);
```

Para:
```typescript
// Sync column order when new custom fields are added
useEffect(() => {
  const allIds = allColumns.map((c) => c.id);
  const newIds = allIds.filter((id) => !columnOrder.includes(id));
  if (newIds.length > 0) {
    setColumnOrder((prev) => [...prev, ...newIds]);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [allColumns]); // Intentionally exclude columnOrder to prevent infinite loop
```

### Por Que Remover `columnOrder` das Dependências

O `columnOrder` é atualizado *dentro* do próprio efeito. Incluí-lo nas dependências causaria:
1. useEffect executa → atualiza columnOrder
2. columnOrder mudou → useEffect executa novamente
3. Loop infinito

A solução correta é usar a função de atualização (`prev => ...`) que não depende do valor atual do estado externo.

---

## Resultado Esperado

Após a correção:
1. O funil carregará normalmente sem loops infinitos
2. Novas colunas personalizadas serão adicionadas à ordem quando criadas
3. O spinner de loading não ficará aparecendo indefinidamente
4. Performance significativamente melhor
