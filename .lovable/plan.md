
# Correção: Contador de Cards do Funil Incorreto

## Problema Identificado

O contador de deals por etapa do funil está mostrando valores incorretos porque a query atual em `useStageDealCounts` busca **todos os `stage_id`** para contar no JavaScript, mas o Supabase tem um **limite padrão de 1000 registros por query**.

### Dados Reais vs Contagem Atual

| Etapa | Total Real | Limite Query |
|-------|------------|--------------|
| Abaixo - Assinado Causa Animal | **1.070** | Max 1000 retornados |
| Contato Gabinete | **622** | Parcialmente contado |
| **Total do Funil** | **1.716** | Apenas 1000 processados |

### Código Atual (Problemático)

```typescript
// src/hooks/useFunnelDeals.ts - linha 25
const { data, error } = await supabase
  .from('funnel_deals')
  .select('stage_id')  // <-- Busca TODOS os stage_ids
  .eq('funnel_id', funnelId);
  // SEM LIMITE EXPLICITO = limite padrão 1000

// Depois conta no JavaScript...
(data || []).forEach((deal) => {
  counts[deal.stage_id] = (counts[deal.stage_id] || 0) + 1;
});
```

---

## Solução

Usar uma **RPC (stored procedure)** ou uma query com agregação direta no banco de dados para obter as contagens corretas, evitando o limite de 1000 registros.

### Arquivo a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/hooks/useFunnelDeals.ts` | Modificar query para usar COUNT agregado via RPC |

### Opcao 1: Criar RPC no Banco (Recomendado)

Criar uma function no banco que retorna as contagens agregadas:

```sql
CREATE OR REPLACE FUNCTION get_stage_deal_counts(p_funnel_id UUID)
RETURNS TABLE(stage_id UUID, count BIGINT)
LANGUAGE SQL
STABLE
AS $$
  SELECT stage_id, COUNT(*)::BIGINT as count
  FROM funnel_deals
  WHERE funnel_id = p_funnel_id
  GROUP BY stage_id;
$$;
```

### Opcao 2: Query Paginada (Workaround)

Se nao puder criar RPC, paginar a query para buscar todos os registros:

```typescript
// Buscar em chunks de 1000 ate nao ter mais registros
let allData: { stage_id: string }[] = [];
let offset = 0;
const pageSize = 1000;
let hasMore = true;

while (hasMore) {
  const { data } = await supabase
    .from('funnel_deals')
    .select('stage_id')
    .eq('funnel_id', funnelId)
    .range(offset, offset + pageSize - 1);
  
  if (data && data.length > 0) {
    allData = [...allData, ...data];
    offset += pageSize;
    hasMore = data.length === pageSize;
  } else {
    hasMore = false;
  }
}
```

---

## Implementacao Recomendada

Usaremos a **Opcao 1 (RPC)** por ser mais eficiente - a contagem acontece diretamente no banco sem transferir milhares de registros.

### Passo 1: Criar Migration

```sql
-- Criar funcao para contagem agregada
CREATE OR REPLACE FUNCTION get_stage_deal_counts(p_funnel_id UUID)
RETURNS TABLE(stage_id UUID, deal_count BIGINT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT fd.stage_id, COUNT(*)::BIGINT as deal_count
  FROM funnel_deals fd
  WHERE fd.funnel_id = p_funnel_id
  GROUP BY fd.stage_id;
$$;
```

### Passo 2: Atualizar Hook

```typescript
// src/hooks/useFunnelDeals.ts
export const useStageDealCounts = (funnelId: string | undefined) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['stage-deal-counts', funnelId],
    queryFn: async (): Promise<StageDealCounts> => {
      if (!funnelId) return {};
      
      // Usar RPC para contagem agregada (evita limite de 1000)
      const { data, error } = await supabase
        .rpc('get_stage_deal_counts', { p_funnel_id: funnelId });

      if (error) throw error;

      // Converter array para objeto
      const counts: StageDealCounts = {};
      (data || []).forEach((row: { stage_id: string; deal_count: number }) => {
        counts[row.stage_id] = row.deal_count;
      });

      return counts;
    },
    enabled: !!user?.id && !!funnelId
  });
};
```

---

## Resultado Esperado

Apos a correcao:
- Contador exibira **1.070** para "Abaixo - Assinado Causa Animal" (valor real)
- Contador exibira **622** para "Contato Gabinete" (valor real)
- Botao "Carregar mais" mostrara a quantidade correta de deals restantes
- Funciona para funis com qualquer quantidade de deals (sem limite)
