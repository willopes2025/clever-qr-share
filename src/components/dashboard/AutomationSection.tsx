import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useAutomationMetrics, DateRange } from '@/hooks/useDashboardMetricsV2';
import { Bot, Zap, CheckCircle, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

interface AutomationSectionProps {
  dateRange: DateRange;
}

export const AutomationSection = ({ dateRange }: AutomationSectionProps) => {
  const { data, isLoading } = useAutomationMetrics(dateRange);

  const metrics = [
    { title: 'Fluxos Ativos', value: data?.activeFlows || 0, icon: Bot, color: 'text-purple-500' },
    { title: 'Disparados Hoje', value: data?.flowsTriggeredToday || 0, icon: Zap, color: 'text-yellow-500' },
    { title: 'Resolvidos Bot', value: data?.resolvedByBot || 0, icon: CheckCircle, color: 'text-green-500' },
    { title: 'Transferidos', value: data?.transferredToHuman || 0, icon: ArrowRightLeft, color: 'text-blue-500' },
    { title: 'Falhas', value: data?.flowFailures || 0, icon: AlertTriangle, color: 'text-red-500' },
  ];

  const pieData = [
    { name: 'Resolvidos pelo Bot', value: data?.resolvedByBot || 0, color: 'hsl(142, 71%, 45%)' },
    { name: 'Transferidos', value: data?.transferredToHuman || 0, color: 'hsl(217, 91%, 60%)' },
  ].filter(d => d.value > 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          🤖 Automação / Bots
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-2">
          {metrics.slice(0, 3).map((metric, index) => (
            <div key={index} className="flex flex-col items-center p-2 rounded-lg border bg-card">
              <metric.icon className={`h-4 w-4 ${metric.color} mb-1`} />
              {isLoading ? (
                <Skeleton className="h-5 w-8" />
              ) : (
                <span className="font-bold">{metric.value}</span>
              )}
              <span className="text-xs text-muted-foreground text-center">{metric.title}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {metrics.slice(3).map((metric, index) => (
            <div key={index} className="flex items-center gap-2 p-2 rounded-lg border bg-card">
              <metric.icon className={`h-4 w-4 ${metric.color}`} />
              <div className="flex flex-col">
                {isLoading ? (
                  <Skeleton className="h-4 w-6" />
                ) : (
                  <span className="font-semibold text-sm">{metric.value}</span>
                )}
                <span className="text-xs text-muted-foreground">{metric.title}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Bot Success Rate */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Taxa de Sucesso do Bot</span>
            {isLoading ? (
              <Skeleton className="h-5 w-12" />
            ) : (
              <span className="font-bold text-lg">
                {(data?.botSuccessRate || 0).toFixed(1)}%
              </span>
            )}
          </div>
          <Progress 
            value={data?.botSuccessRate || 0} 
            className="h-3"
          />
        </div>

        {/* Resolution Distribution */}
        {pieData.length > 0 && (
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={25}
                  outerRadius={45}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [value.toLocaleString(), 'Conversas']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    fontSize: '12px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
