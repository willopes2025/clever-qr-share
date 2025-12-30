import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useAlertMetrics } from '@/hooks/useDashboardMetricsV2';
import { AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';

const alertConfig = {
  critical: {
    icon: AlertCircle,
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    textColor: 'text-red-600',
    badgeVariant: 'destructive' as const,
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    textColor: 'text-yellow-600',
    badgeVariant: 'secondary' as const,
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    textColor: 'text-blue-600',
    badgeVariant: 'outline' as const,
  },
};

export const AlertsSection = () => {
  const { data, isLoading } = useAlertMetrics();

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            🚨 Alertas
          </CardTitle>
          {!isLoading && (
            <div className="flex gap-2">
              {data?.criticalCount ? (
                <Badge variant="destructive">{data.criticalCount} críticos</Badge>
              ) : null}
              {data?.warningCount ? (
                <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600">
                  {data.warningCount} atenção
                </Badge>
              ) : null}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : data?.alerts && data.alerts.length > 0 ? (
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {data.alerts.map((alert) => {
              const config = alertConfig[alert.type];
              const Icon = config.icon;
              
              return (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border ${config.bgColor} ${config.borderColor} transition-colors hover:opacity-90`}
                >
                  <div className="flex items-start gap-3">
                    <Icon className={`h-5 w-5 ${config.textColor} flex-shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`font-medium text-sm ${config.textColor}`}>
                          {alert.title}
                        </span>
                        {alert.count && (
                          <Badge variant={config.badgeVariant} className="text-xs">
                            {alert.count}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {alert.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle className="h-10 w-10 text-green-500 mb-2" />
            <span className="font-medium text-green-600">Tudo certo!</span>
            <span className="text-sm text-muted-foreground">
              Nenhum alerta no momento
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
