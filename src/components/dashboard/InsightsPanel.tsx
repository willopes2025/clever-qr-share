import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useInsights, DateRange, Insight } from '@/hooks/useAdvancedDashboardMetrics';
import { AlertTriangle, CheckCircle, Info, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InsightsPanelProps {
  dateRange: DateRange;
}

function InsightCard({ insight }: { insight: Insight }) {
  const config = {
    warning: {
      icon: AlertTriangle,
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
      iconColor: 'text-amber-500',
    },
    success: {
      icon: CheckCircle,
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20',
      iconColor: 'text-green-500',
    },
    info: {
      icon: Info,
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
      iconColor: 'text-blue-500',
    },
  };

  const { icon: Icon, bgColor, borderColor, iconColor } = config[insight.type];

  return (
    <div className={cn(
      'flex items-start gap-3 p-3 rounded-lg border',
      bgColor,
      borderColor
    )}>
      <Icon className={cn('h-5 w-5 mt-0.5 flex-shrink-0', iconColor)} />
      <div className="space-y-0.5 min-w-0">
        <p className="text-sm font-medium">{insight.title}</p>
        <p className="text-xs text-muted-foreground">{insight.description}</p>
      </div>
    </div>
  );
}

export function InsightsPanel({ dateRange }: InsightsPanelProps) {
  const insights = useInsights(dateRange);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-3">
        <Lightbulb className="h-5 w-5 text-amber-500" />
        <CardTitle className="text-lg">Insights</CardTitle>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            <div className="text-center">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p>Tudo funcionando bem!</p>
              <p className="text-xs">Nenhum alerta no momento</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
