import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  iconColor?: string;
  isLoading?: boolean;
}

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  iconColor = 'text-primary',
  isLoading,
}: KPICardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground';

  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-3 flex-1">
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              <div className="h-8 w-32 bg-muted rounded animate-pulse" />
              <div className="h-3 w-20 bg-muted rounded animate-pulse" />
            </div>
            <div className="h-12 w-12 bg-muted rounded-xl animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            <div className="flex items-center gap-2">
              {trend && trendValue && (
                <div className={cn('flex items-center gap-1 text-xs font-medium', trendColor)}>
                  <TrendIcon className="h-3 w-3" />
                  <span>{trendValue}</span>
                </div>
              )}
              {subtitle && (
                <span className="text-xs text-muted-foreground">{subtitle}</span>
              )}
            </div>
          </div>
          <div className={cn('p-3 rounded-xl bg-primary/10 group-hover:scale-110 transition-transform', iconColor)}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
