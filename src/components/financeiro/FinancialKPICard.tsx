import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface FinancialKPICardProps {
  title: string;
  value: number;
  subtitle?: string;
  growth?: number;
  icon: LucideIcon;
  iconColor?: string;
  borderColor?: string;
  isLoading?: boolean;
  format?: 'currency' | 'percentage' | 'number';
}

const formatValue = (value: number, format: 'currency' | 'percentage' | 'number' = 'currency'): string => {
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(value);
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'number':
      return new Intl.NumberFormat('pt-BR').format(value);
    default:
      return String(value);
  }
};

export const FinancialKPICard = ({
  title,
  value,
  subtitle,
  growth,
  icon: Icon,
  iconColor = 'text-primary',
  borderColor = 'border-primary/20',
  isLoading = false,
  format = 'currency',
}: FinancialKPICardProps) => {
  const GrowthIcon = growth === undefined || growth === 0 
    ? Minus 
    : growth > 0 
      ? TrendingUp 
      : TrendingDown;
  
  const growthColor = growth === undefined || growth === 0
    ? 'text-muted-foreground'
    : growth > 0
      ? 'text-green-500'
      : 'text-red-500';

  return (
    <Card className={cn('transition-all hover:shadow-md', borderColor)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className={cn('text-2xl font-bold', iconColor)}>
                {formatValue(value, format)}
              </span>
              {growth !== undefined && (
                <div className={cn('flex items-center text-xs', growthColor)}>
                  <GrowthIcon className="h-3 w-3 mr-0.5" />
                  <span>{Math.abs(growth).toFixed(1)}%</span>
                </div>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
