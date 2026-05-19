import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { useMessagesByHour } from '@/hooks/useMessagesByHour';
import { DateRange, CustomDateRange } from '@/hooks/useDashboardMetricsV2';

interface MessagesByHourChartProps {
  dateRange: DateRange;
  customRange?: CustomDateRange;
}

// Palette using design-system chart tokens, with fallbacks
const SERIES_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 173 58% 39%))',
  'hsl(var(--chart-3, 197 37% 24%))',
  'hsl(var(--chart-4, 43 74% 66%))',
  'hsl(var(--chart-5, 27 87% 67%))',
  'hsl(var(--chart-1, 12 76% 61%))',
  'hsl(220 70% 50%)',
  'hsl(280 65% 60%)',
  'hsl(340 75% 55%)',
  'hsl(160 60% 45%)',
  'hsl(40 90% 55%)',
  'hsl(200 80% 50%)',
];

export const MessagesByHourChart = ({ dateRange, customRange }: MessagesByHourChartProps) => {
  const [view, setView] = useState<'aggregate' | 'byUser'>('aggregate');
  const { data, isLoading } = useMessagesByHour(dateRange, customRange);

  const totalMessages = useMemo(
    () => (data?.aggregate || []).reduce((acc, d) => acc + d.total, 0),
    [data],
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 gap-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 rounded-md bg-primary/10">
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          <div className="flex flex-col min-w-0">
            <CardTitle className="text-lg">Mensagens por hora</CardTitle>
            <span className="text-xs text-muted-foreground">
              Total no período: {totalMessages.toLocaleString('pt-BR')}
            </span>
          </div>
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as 'aggregate' | 'byUser')}>
          <TabsList>
            <TabsTrigger value="aggregate">Geral</TabsTrigger>
            <TabsTrigger value="byUser">Por usuário</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[320px] w-full" />
        ) : view === 'aggregate' ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data?.aggregate || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="hourLabel"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                stroke="hsl(var(--border))"
              />
              <YAxis
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                stroke="hsl(var(--border))"
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  color: 'hsl(var(--popover-foreground))',
                }}
                labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                formatter={(v: number) => [v.toLocaleString('pt-BR'), 'Mensagens']}
              />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data?.byUser || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="hourLabel"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                stroke="hsl(var(--border))"
              />
              <YAxis
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                stroke="hsl(var(--border))"
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  color: 'hsl(var(--popover-foreground))',
                }}
                labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {(data?.users || []).map((u, idx) => (
                <Bar
                  key={u.userId}
                  dataKey={u.name}
                  stackId="messages"
                  fill={SERIES_COLORS[idx % SERIES_COLORS.length]}
                  radius={idx === (data?.users.length || 0) - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
        {!isLoading && totalMessages === 0 && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            Nenhuma mensagem enviada no período selecionado.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
