import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Bell, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { format, parseISO, differenceInDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from '@/hooks/useFinancialMetrics';

interface BillingRemindersChartProps {
  dateRange: DateRange;
}

const REMINDER_TYPE_LABELS: Record<string, string> = {
  emitted: 'Emissão',
  before_5d: '5 dias antes',
  due_day: 'No vencimento',
  after_1d: '+1 dia',
  after_3d: '+3 dias',
  after_5d: '+5 dias',
};

const REMINDER_TYPE_COLORS: Record<string, string> = {
  emitted: 'hsl(220, 70%, 55%)',
  before_5d: 'hsl(270, 60%, 55%)',
  due_day: 'hsl(45, 85%, 50%)',
  after_1d: 'hsl(25, 80%, 55%)',
  after_3d: 'hsl(10, 75%, 55%)',
  after_5d: 'hsl(0, 70%, 50%)',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: 'Pendentes', color: 'hsl(45, 85%, 50%)', icon: Clock },
  sent: { label: 'Enviados', color: 'hsl(142, 70%, 45%)', icon: CheckCircle },
  failed: { label: 'Falhas', color: 'hsl(0, 70%, 50%)', icon: XCircle },
  cancelled: { label: 'Cancelados', color: 'hsl(220, 10%, 60%)', icon: AlertTriangle },
};

interface ReminderRow {
  scheduled_for: string;
  reminder_type: string;
  status: string;
  error_message: string | null;
}

const chartConfig = {
  emitted: { label: 'Emissão', color: REMINDER_TYPE_COLORS.emitted },
  before_5d: { label: '5 dias antes', color: REMINDER_TYPE_COLORS.before_5d },
  due_day: { label: 'No vencimento', color: REMINDER_TYPE_COLORS.due_day },
  after_1d: { label: '+1 dia', color: REMINDER_TYPE_COLORS.after_1d },
  after_3d: { label: '+3 dias', color: REMINDER_TYPE_COLORS.after_3d },
  after_5d: { label: '+5 dias', color: REMINDER_TYPE_COLORS.after_5d },
};

export const BillingRemindersChart = ({ dateRange }: BillingRemindersChartProps) => {
  const [data, setData] = useState<ReminderRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const days = differenceInDays(dateRange.end, dateRange.start);
      const futureEnd = addDays(new Date(), days);
      const { data: reminders, error } = await supabase
        .from('billing_reminders')
        .select('scheduled_for, reminder_type, status, error_message')
        .gte('scheduled_for', dateRange.start.toISOString())
        .lte('scheduled_for', futureEnd.toISOString());

      if (!error && reminders) {
        setData(reminders);
      }
      setIsLoading(false);
    };
    fetchData();
  }, [dateRange]);

  // KPIs by status
  const statusCounts = data.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  // Group by date and type for chart
  const byDateType = data.reduce<Record<string, Record<string, number>>>((acc, r) => {
    const dateKey = format(parseISO(r.scheduled_for), 'yyyy-MM-dd');
    if (!acc[dateKey]) acc[dateKey] = {};
    acc[dateKey][r.reminder_type] = (acc[dateKey][r.reminder_type] || 0) + 1;
    return acc;
  }, {});

  const chartData = Object.entries(byDateType)
    .map(([date, types]) => ({
      date,
      label: format(parseISO(date), 'dd/MM', { locale: ptBR }),
      ...types,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const allTypes = [...new Set(data.map(r => r.reminder_type))];

  // Errors detail
  const failedReminders = data.filter(r => r.status === 'failed' && r.error_message);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-5 w-5" /> Disparos de Lembretes
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <span className="text-muted-foreground">Carregando...</span>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-5 w-5" /> Disparos de Lembretes
          </CardTitle>
          <CardDescription>Nenhum lembrete agendado no período selecionado</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon;
          const count = statusCounts[key] || 0;
          return (
            <Card key={key} className="p-3">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" style={{ color: cfg.color }} />
                <span className="text-sm text-muted-foreground">{cfg.label}</span>
              </div>
              <p className="text-2xl font-bold mt-1">{count}</p>
            </Card>
          );
        })}
      </div>

      {/* Stacked Bar Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-5 w-5" /> Disparos de Lembretes por Data
          </CardTitle>
          <CardDescription>Quantidade de lembretes agendados por data e tipo</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis dataKey="label" className="text-xs" />
              <YAxis allowDecimals={false} className="text-xs" />
              <ChartTooltip content={<ChartTooltipContent />} />
              {allTypes.map(type => (
                <Bar
                  key={type}
                  dataKey={type}
                  stackId="stack"
                  fill={REMINDER_TYPE_COLORS[type] || 'hsl(220, 10%, 50%)'}
                  name={REMINDER_TYPE_LABELS[type] || type}
                  radius={[0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ChartContainer>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-3 justify-center">
            {allTypes.map(type => (
              <div key={type} className="flex items-center gap-1.5 text-xs">
                <div
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: REMINDER_TYPE_COLORS[type] }}
                />
                <span className="text-muted-foreground">{REMINDER_TYPE_LABELS[type] || type}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Status breakdown by type */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Resumo por Tipo de Lembrete</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium text-muted-foreground">Tipo</th>
                  <th className="text-center py-2 font-medium text-muted-foreground">Total</th>
                  <th className="text-center py-2 font-medium text-muted-foreground">Pendentes</th>
                  <th className="text-center py-2 font-medium text-muted-foreground">Enviados</th>
                  <th className="text-center py-2 font-medium text-muted-foreground">Falhas</th>
                  <th className="text-center py-2 font-medium text-muted-foreground">Cancelados</th>
                </tr>
              </thead>
              <tbody>
                {allTypes.map(type => {
                  const ofType = data.filter(r => r.reminder_type === type);
                  const pending = ofType.filter(r => r.status === 'pending').length;
                  const sent = ofType.filter(r => r.status === 'sent').length;
                  const failed = ofType.filter(r => r.status === 'failed').length;
                  const cancelled = ofType.filter(r => r.status === 'cancelled').length;
                  return (
                    <tr key={type} className="border-b last:border-0">
                      <td className="py-2 flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: REMINDER_TYPE_COLORS[type] }} />
                        {REMINDER_TYPE_LABELS[type] || type}
                      </td>
                      <td className="text-center py-2 font-medium">{ofType.length}</td>
                      <td className="text-center py-2">
                        {pending > 0 && <Badge variant="outline" className="text-yellow-600 border-yellow-300">{pending}</Badge>}
                        {pending === 0 && <span className="text-muted-foreground">0</span>}
                      </td>
                      <td className="text-center py-2">
                        {sent > 0 && <Badge variant="outline" className="text-green-600 border-green-300">{sent}</Badge>}
                        {sent === 0 && <span className="text-muted-foreground">0</span>}
                      </td>
                      <td className="text-center py-2">
                        {failed > 0 && <Badge variant="destructive">{failed}</Badge>}
                        {failed === 0 && <span className="text-muted-foreground">0</span>}
                      </td>
                      <td className="text-center py-2">
                        {cancelled > 0 && <Badge variant="secondary">{cancelled}</Badge>}
                        {cancelled === 0 && <span className="text-muted-foreground">0</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Error details */}
      {failedReminders.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-destructive flex items-center gap-2">
              <XCircle className="h-4 w-4" /> Erros nos Disparos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {failedReminders.slice(0, 10).map((r, i) => (
                <div key={i} className="text-xs flex items-start gap-2 p-2 rounded bg-destructive/5">
                  <span className="text-muted-foreground whitespace-nowrap">
                    {format(parseISO(r.scheduled_for), 'dd/MM HH:mm')}
                  </span>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {REMINDER_TYPE_LABELS[r.reminder_type] || r.reminder_type}
                  </Badge>
                  <span className="text-destructive">{r.error_message}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
