import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DelinquencyAnalysisProps {
  rate: number;
  overdueTotal: number;
  overdueCount: number;
  isLoading?: boolean;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const getRateColor = (rate: number): string => {
  if (rate <= 5) return 'text-green-500';
  if (rate <= 15) return 'text-yellow-500';
  if (rate <= 30) return 'text-orange-500';
  return 'text-red-500';
};

const getRateLabel = (rate: number): string => {
  if (rate <= 5) return 'Excelente';
  if (rate <= 15) return 'Bom';
  if (rate <= 30) return 'Atenção';
  return 'Crítico';
};

const getProgressColor = (rate: number): string => {
  if (rate <= 5) return 'bg-green-500';
  if (rate <= 15) return 'bg-yellow-500';
  if (rate <= 30) return 'bg-orange-500';
  return 'bg-red-500';
};

export const DelinquencyAnalysis = ({
  rate,
  overdueTotal,
  overdueCount,
  isLoading = false,
}: DelinquencyAnalysisProps) => {
  const clampedRate = Math.min(rate, 100);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Taxa de Inadimplência</CardTitle>
            <CardDescription>Percentual de cobranças em atraso</CardDescription>
          </div>
          <AlertTriangle className={cn('h-5 w-5', getRateColor(rate))} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Rate gauge */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className={cn('text-3xl font-bold', getRateColor(rate))}>
              {rate.toFixed(1)}%
            </span>
            <span className={cn('text-sm font-medium', getRateColor(rate))}>
              {getRateLabel(rate)}
            </span>
          </div>
          <div className="relative">
            <Progress value={clampedRate} className="h-3" />
            <div
              className={cn(
                'absolute top-0 left-0 h-3 rounded-full transition-all',
                getProgressColor(rate)
              )}
              style={{ width: `${clampedRate}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div>
            <p className="text-xs text-muted-foreground">Total em atraso</p>
            <p className="text-lg font-semibold text-destructive">
              {formatCurrency(overdueTotal)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cobranças vencidas</p>
            <p className="text-lg font-semibold text-destructive">
              {overdueCount}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
