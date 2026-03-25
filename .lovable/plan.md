

## Por que a aba de Funil fica reiniciando

### Causa raiz

O problema está no `SubscriptionContext.tsx`, linha 37 e 110:

```text
const checkSubscription = useCallback(async (isInitial = false) => {
  if (isInitial || !subscription) {   // <-- usa `subscription` do closure
    setLoading(true);                 // <-- força loading = true
  }
  ...
}, [authLoading]);  // <-- `subscription` NÃO está nas dependências
```

O `useCallback` tem apenas `[authLoading]` como dependência, mas usa `subscription` internamente. Como `subscription` não está no array de dependências, o valor capturado é **sempre o valor antigo** (geralmente `null` do render inicial).

**Resultado:** a cada 5 minutos, o intervalo chama `checkSubscription()` → `!subscription` é `true` (valor stale) → `setLoading(true)` → toda a árvore de componentes que depende de `loading` (incluindo Funis) **desmonta e remonta**, perdendo o estado local (funil selecionado, aba ativa, etc.).

Quando você sai da tela e volta, o mesmo ciclo recomeça porque o componente é recriado do zero e aguarda o `loading` do contexto terminar.

### Correção

**Arquivo:** `src/contexts/SubscriptionContext.tsx`

1. **Usar um `ref` para rastrear se já houve carregamento inicial**, em vez de depender do valor stale de `subscription`:

```typescript
const hasLoadedRef = useRef(false);

const checkSubscription = useCallback(async (isInitial = false) => {
  if (checkInFlightRef.current) return;
  if (authLoading) return;
  
  checkInFlightRef.current = true;
  // Só mostra loading na primeira vez
  if (!hasLoadedRef.current) {
    setLoading(true);
  }
  
  try {
    // ... lógica existente ...
    setSubscription(data);
    hasLoadedRef.current = true;  // marca como carregado
  } finally {
    setLoading(false);
    checkInFlightRef.current = false;
  }
}, [authLoading]);
```

2. **Resetar o ref quando o usuário faz logout:**
```typescript
} else if (!user) {
  setSubscription(null);
  setLoading(false);
  hasLoadedRef.current = false;  // reset
}
```

Isso garante que `setLoading(true)` **nunca** seja chamado em verificações de background, evitando a desmontagem dos componentes.

### Arquivos a editar
- `src/contexts/SubscriptionContext.tsx` — substituir lógica de `isInitial || !subscription` por `hasLoadedRef`

