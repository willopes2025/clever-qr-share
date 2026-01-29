

# Correção: Card de Total de Deals Abertos Incorreto

## Problema Identificado

O card "Deals Abertos" e outras métricas no `FunnelMetricsCard` e `FunnelDashboard` estão mostrando valores incorretos porque:

1. A query principal em `useFunnels.ts` carrega apenas **50 deals por estágio** (linha 126: `.limit(50)`) para performance
2. Os componentes de métricas calculam as contagens fazendo `stages.flatMap(s => s.deals || [])` - ou seja, contam apenas os deals carregados (máximo 50 x N estágios)
3. A função RPC `get_stage_deal_counts` que criamos é usada apenas no Kanban/ListView para os contadores por estágio, mas **não é usada** nos cards de métricas

### Dados do Cliente Matheus Suave

| Métrica | Valor Mostrado (max) | Valor Real |
|---------|---------------------|------------|
| Deals Abertos | ~100 (50x2 estágios) | 1.692+ |
| Pipeline Total | Sub-calculado | Valor real maior |
| Outros indicadores | Incorretos | - |

---

## Solução

Criar uma nova RPC que retorna métricas agregadas do funil diretamente do banco de dados, e atualizar os componentes para usá-la.

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/migrations/...` | Criar RPC `get_funnel_metrics` |
| `src/hooks/useFunnelDeals.ts` | Adicionar hook `useFunnelMetrics` |
| `src/components/funnels/FunnelMetricsCard.tsx` | Usar o novo hook |
| `src/components/funnels/FunnelDashboard.tsx` | Usar o novo hook para contagens precisas |

---

## Implementação

### Passo 1: Criar Migration com RPC

```sql
-- Função para calcular métricas agregadas do funil
CREATE OR REPLACE FUNCTION get_funnel_metrics(p_funnel_id UUID)
RETURNS TABLE(
  open_deals_count BIGINT,
  won_deals_count BIGINT,
  lost_deals_count BIGINT,
  open_deals_value NUMERIC,
  won_deals_value NUMERIC,
  lost_deals_value NUMERIC,
  avg_days_to_close NUMERIC
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH stage_types AS (
    SELECT id, final_type FROM funnel_stages WHERE funnel_id = p_funnel_id
  ),
  deals_with_type AS (
    SELECT 
      fd.*,
      st.final_type
    FROM funnel_deals fd
    JOIN stage_types st ON fd.stage_id = st.id
    WHERE fd.funnel_id = p_funnel_id
  ),
  open_metrics AS (
    SELECT 
      COUNT(*)::BIGINT as count,
      COALESCE(SUM(value), 0)::NUMERIC as total_value
    FROM deals_with_type
    WHERE final_type IS NULL OR final_type NOT IN ('won', 'lost')
  ),
  won_metrics AS (
    SELECT 
      COUNT(*)::BIGINT as count,
      COALESCE(SUM(value), 0)::NUMERIC as total_value,
      COALESCE(AVG(
        EXTRACT(EPOCH FROM (closed_at - created_at)) / 86400
      ), 0)::NUMERIC as avg_days
    FROM deals_with_type
    WHERE final_type = 'won'
  ),
  lost_metrics AS (
    SELECT 
      COUNT(*)::BIGINT as count,
      COALESCE(SUM(value), 0)::NUMERIC as total_value
    FROM deals_with_type
    WHERE final_type = 'lost'
  )
  SELECT 
    o.count as open_deals_count,
    w.count as won_deals_count,
    l.count as lost_deals_count,
    o.total_value as open_deals_value,
    w.total_value as won_deals_value,
    l.total_value as lost_deals_value,
    w.avg_days as avg_days_to_close
  FROM open_metrics o, won_metrics w, lost_metrics l;
$$;
```

### Passo 2: Criar Hook `useFunnelMetrics`

```typescript
// Em src/hooks/useFunnelDeals.ts
export interface FunnelMetrics {
  openDealsCount: number;
  wonDealsCount: number;
  lostDealsCount: number;
  openDealsValue: number;
  wonDealsValue: number;
  lostDealsValue: number;
  avgDaysToClose: number;
}

export const useFunnelMetrics = (funnelId: string | undefined) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['funnel-metrics', funnelId],
    queryFn: async (): Promise<FunnelMetrics | null> => {
      if (!funnelId) return null;
      
      const { data, error } = await supabase
        .rpc('get_funnel_metrics', { p_funnel_id: funnelId });

      if (error) throw error;

      const row = data?.[0];
      if (!row) return null;

      return {
        openDealsCount: Number(row.open_deals_count) || 0,
        wonDealsCount: Number(row.won_deals_count) || 0,
        lostDealsCount: Number(row.lost_deals_count) || 0,
        openDealsValue: Number(row.open_deals_value) || 0,
        wonDealsValue: Number(row.won_deals_value) || 0,
        lostDealsValue: Number(row.lost_deals_value) || 0,
        avgDaysToClose: Number(row.avg_days_to_close) || 0,
      };
    },
    enabled: !!user?.id && !!funnelId
  });
};
```

### Passo 3: Atualizar FunnelMetricsCard

```typescript
import { useFunnelMetrics } from "@/hooks/useFunnelDeals";

export const FunnelMetricsCard = ({ funnel }: FunnelMetricsCardProps) => {
  const { data: metrics, isLoading } = useFunnelMetrics(funnel.id);
  
  // Usar metrics?.openDealsCount em vez de calcular localmente
  // ...
};
```

### Passo 4: Atualizar FunnelDashboard

Similarmente, usar o hook `useFunnelMetrics` para os cards de resumo no dashboard.

---

## Resultado Esperado

Após a correção:
- Card "Deals Abertos" mostrará o valor real (1.692+ para o cliente Matheus Suave)
- "Pipeline Total" calculará o valor correto de todos os deals
- "Deals Ganhos" e "Deals Perdidos" mostrarão contagens precisas
- "Taxa de Conversão" será calculada corretamente
- "Tempo Médio para Fechar" usará todos os deals ganhos

---

## Vantagens da Solução

1. **Performance**: Agregação no banco é muito mais rápida que transferir milhares de registros
2. **Precisão**: Sem limite de registros, contagens sempre corretas
3. **Consistência**: Mesma abordagem usada para contagem por estágio (RPC)
4. **Escalabilidade**: Funciona para funis com qualquer quantidade de deals

