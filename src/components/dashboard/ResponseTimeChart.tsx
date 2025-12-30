import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useResponseTimeMetrics, DateRange } from '@/hooks/useAdvancedDashboardMetrics';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, Area, ComposedChart } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResponseTimeChartProps {
  dateRange: DateRange;
}

function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

const TARGET_RESPONSE_TIME = 300; // 5 minutes in seconds

export function ResponseTimeChart({ dateRange }: ResponseTimeChartProps) {
  const { data, isLoading } = useResponseTimeMetrics(dateRange);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tempo de Resposta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  const chartData = data?.dailyData.map(d => ({
    ...d,
    dateFormatted: format(parseISO(d.date), 'dd/MM', { locale: ptBR }),
    avgTimeMinutes: d.avgTime / 60,
  })) || [];

  const avgTime = data?.avgResponseTime || 0;
  const isGood = avgTime < TARGET_RESPONSE_TIME;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Tempo de Resposta</CardTitle>
        <div className="flex items-center gap-2">
          <div className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium',
            isGood ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'
          )}>
            {isGood ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            <span>{formatTime(avgTime)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            Nenhum dado de tempo de resposta no período
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorResponse" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="dateFormatted" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  tickFormatter={(value) => `${Math.round(value)}m`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number) => [formatTime(value * 60), 'Média']}
                />
                <ReferenceLine 
                  y={TARGET_RESPONSE_TIME / 60} 
                  stroke="#22c55e" 
                  strokeDasharray="5 5" 
                  label={{ value: 'Meta: 5min', fill: '#22c55e', fontSize: 11, position: 'right' }}
                />
                <Area
                  type="monotone"
                  dataKey="avgTimeMinutes"
                  fill="url(#colorResponse)"
                  stroke="none"
                />
                <Line
                  type="monotone"
                  dataKey="avgTimeMinutes"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-6 mt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-primary rounded" />
                <span>Tempo médio</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-green-500 rounded" style={{ borderStyle: 'dashed', borderWidth: '1px', borderColor: '#22c55e' }} />
                <span>Meta (5 min)</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
