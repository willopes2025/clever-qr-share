import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDealStatusMetrics, DateRange } from '@/hooks/useAdvancedDashboardMetrics';
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip } from 'recharts';

interface DealStatusChartProps {
  dateRange: DateRange;
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
  }).format(value);
}

const COLORS = {
  won: '#22c55e',
  lost: '#ef4444',
  open: 'hsl(var(--primary))',
};

export function DealStatusChart({ dateRange }: DealStatusChartProps) {
  const { data, isLoading } = useDealStatusMetrics(dateRange);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Status dos Deals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center">
            <div className="w-40 h-40 rounded-full bg-muted animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = [
    { name: 'Ganhos', value: data?.won || 0, amount: data?.wonValue || 0, color: COLORS.won },
    { name: 'Perdidos', value: data?.lost || 0, amount: data?.lostValue || 0, color: COLORS.lost },
    { name: 'Em aberto', value: data?.open || 0, amount: data?.openValue || 0, color: COLORS.open },
  ].filter(d => d.value > 0);

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Status dos Deals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[250px] text-muted-foreground">
            Nenhum deal no período
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Status dos Deals</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={4}
              dataKey="value"
              stroke="none"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              formatter={(value: number, name: string, props: any) => {
                const entry = props.payload;
                return [`${value} deals (${formatCurrency(entry.amount)})`, name];
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value, entry: any) => {
                const item = chartData.find(d => d.name === value);
                return (
                  <span className="text-sm text-muted-foreground">
                    {value}: {item?.value || 0}
                  </span>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-green-600">{data?.won || 0}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(data?.wonValue || 0)}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-500">{data?.lost || 0}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(data?.lostValue || 0)}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">{data?.open || 0}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(data?.openValue || 0)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
