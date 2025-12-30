import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useLeadMetrics, DateRange } from '@/hooks/useDashboardMetricsV2';
import { Users, Calendar, CalendarDays, Copy, RefreshCcw } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

interface LeadsSectionProps {
  dateRange: DateRange;
}

const COLORS = ['hsl(var(--primary))', 'hsl(217, 91%, 60%)', 'hsl(142, 71%, 45%)', 'hsl(48, 96%, 53%)', 'hsl(280, 87%, 65%)'];

export const LeadsSection = ({ dateRange }: LeadsSectionProps) => {
  const { data, isLoading } = useLeadMetrics(dateRange);

  const metrics = [
    { title: 'Hoje', value: data?.leadsToday || 0, icon: Users },
    { title: 'Semana', value: data?.leadsWeek || 0, icon: Calendar },
    { title: 'Mês', value: data?.leadsMonth || 0, icon: CalendarDays },
  ];

  const pieData = data?.leadsBySource.slice(0, 5).map((item, index) => ({
    name: item.source,
    value: item.count,
    fill: COLORS[index % COLORS.length],
  })) || [];

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          👥 Leads
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Lead Counts */}
        <div className="grid grid-cols-3 gap-3">
          {metrics.map((metric, index) => (
            <div key={index} className="flex flex-col items-center p-3 rounded-lg border bg-card">
              <metric.icon className="h-4 w-4 text-primary mb-1" />
              {isLoading ? (
                <Skeleton className="h-6 w-10" />
              ) : (
                <span className="text-xl font-bold">{metric.value.toLocaleString()}</span>
              )}
              <span className="text-xs text-muted-foreground">{metric.title}</span>
            </div>
          ))}
        </div>

        {/* Additional Metrics */}
        <div className="flex gap-4">
          <div className="flex items-center gap-2 p-2 rounded-lg border bg-card flex-1">
            <Copy className="h-4 w-4 text-yellow-500" />
            <div className="flex flex-col">
              {isLoading ? (
                <Skeleton className="h-4 w-8" />
              ) : (
                <span className="font-semibold text-sm">{data?.duplicateLeads || 0}</span>
              )}
              <span className="text-xs text-muted-foreground">Duplicados</span>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg border bg-card flex-1">
            <RefreshCcw className="h-4 w-4 text-green-500" />
            <div className="flex flex-col">
              {isLoading ? (
                <Skeleton className="h-4 w-8" />
              ) : (
                <span className="font-semibold text-sm">{data?.reactivatedLeads || 0}</span>
              )}
              <span className="text-xs text-muted-foreground">Reativados</span>
            </div>
          </div>
        </div>

        {/* Leads by Source Chart */}
        {pieData.length > 0 && (
          <div className="h-40">
            <span className="text-sm text-muted-foreground mb-2 block">Por Origem</span>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={50}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [value.toLocaleString(), 'Leads']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    fontSize: '12px'
                  }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '10px' }}
                  formatter={(value) => <span className="text-foreground">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
