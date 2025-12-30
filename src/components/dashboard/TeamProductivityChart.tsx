import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTeamProductivityMetrics, DateRange } from '@/hooks/useAdvancedDashboardMetrics';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Cell } from 'recharts';
import { cn } from '@/lib/utils';

interface TeamProductivityChartProps {
  dateRange: DateRange;
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function TeamProductivityChart({ dateRange }: TeamProductivityChartProps) {
  const { data, isLoading } = useTeamProductivityMetrics(dateRange);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Produtividade da Equipe</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  const chartData = data?.memberData.map(m => ({
    name: m.userName.split(' ')[0], // First name only
    fullName: m.userName,
    work: m.workSeconds / 3600, // Convert to hours
    break: m.breakSeconds / 3600,
    lunch: m.lunchSeconds / 3600,
    workFormatted: formatTime(m.workSeconds),
    breakFormatted: formatTime(m.breakSeconds),
    lunchFormatted: formatTime(m.lunchSeconds),
  })) || [];

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Produtividade da Equipe</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            Nenhum dado de produtividade no período
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalHours = data ? (data.totalWorkSeconds / 3600).toFixed(1) : '0';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Produtividade da Equipe</CardTitle>
        <div className="text-right">
          <p className="text-2xl font-bold">{totalHours}h</p>
          <p className="text-xs text-muted-foreground">total trabalhadas</p>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 10, left: 60, bottom: 0 }}>
            <XAxis 
              type="number" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              tickFormatter={(value) => `${value}h`}
            />
            <YAxis 
              type="category" 
              dataKey="name" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              width={50}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number, name: string, props: any) => {
                const entry = props.payload;
                if (name === 'work') return [entry.workFormatted, 'Trabalho'];
                if (name === 'break') return [entry.breakFormatted, 'Intervalo'];
                if (name === 'lunch') return [entry.lunchFormatted, 'Almoço'];
                return [value, name];
              }}
              labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
            />
            <Legend 
              formatter={(value) => {
                if (value === 'work') return 'Trabalho';
                if (value === 'break') return 'Intervalo';
                if (value === 'lunch') return 'Almoço';
                return value;
              }}
            />
            <Bar dataKey="work" name="work" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
            <Bar dataKey="break" name="break" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
            <Bar dataKey="lunch" name="lunch" stackId="a" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
