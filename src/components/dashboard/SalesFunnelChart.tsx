import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFunnelStageMetrics, FunnelStageData } from '@/hooks/useAdvancedDashboardMetrics';
import { cn } from '@/lib/utils';

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
  }).format(value);
}

interface FunnelBarProps {
  stage: FunnelStageData;
  maxValue: number;
  maxCount: number;
}

function FunnelBar({ stage, maxValue, maxCount }: FunnelBarProps) {
  const widthPercentage = maxCount > 0 ? (stage.dealsCount / maxCount) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: stage.color }}
          />
          <span className="font-medium">{stage.stageName}</span>
        </div>
        <div className="flex items-center gap-4 text-muted-foreground">
          <span>{stage.dealsCount} deals</span>
          <span className="font-medium text-foreground">{formatCurrency(stage.dealsValue)}</span>
        </div>
      </div>
      <div className="h-8 bg-muted rounded-lg overflow-hidden">
        <div
          className="h-full rounded-lg transition-all duration-500 flex items-center justify-end pr-3"
          style={{ 
            width: `${Math.max(widthPercentage, 5)}%`,
            backgroundColor: stage.color,
          }}
        >
          {widthPercentage > 20 && (
            <span className="text-xs font-medium text-white">{stage.probability}%</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function SalesFunnelChart() {
  const { data: stages, isLoading } = useFunnelStageMetrics();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Funil de Vendas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                <div className="h-8 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stages || stages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Funil de Vendas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            Nenhuma etapa configurada no funil
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxValue = Math.max(...stages.map(s => s.dealsValue), 1);
  const maxCount = Math.max(...stages.map(s => s.dealsCount), 1);
  const totalValue = stages.reduce((sum, s) => sum + s.dealsValue, 0);
  const totalDeals = stages.reduce((sum, s) => sum + s.dealsCount, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Funil de Vendas</CardTitle>
        <div className="text-right">
          <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
          <p className="text-xs text-muted-foreground">{totalDeals} deals em aberto</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {stages.map((stage) => (
            <FunnelBar 
              key={stage.stageId} 
              stage={stage} 
              maxValue={maxValue} 
              maxCount={maxCount} 
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
