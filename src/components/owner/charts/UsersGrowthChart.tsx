import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  data: { month: string; value: number }[];
}

const UsersGrowthChart = ({ data }: Props) => {
  // Calculate cumulative growth
  let cumulative = 0;
  const chartData = data.map(item => {
    cumulative += item.value;
    return {
      ...item,
      monthLabel: format(parseISO(`${item.month}-01`), 'MMM', { locale: ptBR }),
      cumulative,
    };
  });

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="monthLabel" 
            className="text-xs fill-muted-foreground"
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            yAxisId="left"
            className="text-xs fill-muted-foreground"
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            className="text-xs fill-muted-foreground"
            axisLine={false}
            tickLine={false}
          />
          <Tooltip 
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                return (
                  <div className="bg-popover border rounded-lg p-3 shadow-lg">
                    <p className="text-sm font-medium">{item.month}</p>
                    <p className="text-sm text-muted-foreground">
                      Novos: <span className="font-bold text-primary">{item.value}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Total: <span className="font-bold">{item.cumulative}</span>
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar 
            yAxisId="left"
            dataKey="value" 
            fill="hsl(var(--primary))" 
            radius={[4, 4, 0, 0]}
            opacity={0.8}
          />
          <Line 
            yAxisId="right"
            type="monotone" 
            dataKey="cumulative" 
            stroke="hsl(var(--accent))" 
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default UsersGrowthChart;
