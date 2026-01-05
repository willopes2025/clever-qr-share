import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  data: { plan_name: string; revenue: number; count: number; percentage: number }[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const RevenueByPlanChart = ({ data }: Props) => {
  const chartData = data.filter(item => item.revenue > 0);

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          data={chartData} 
          layout="vertical"
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
          <XAxis 
            type="number"
            className="text-xs fill-muted-foreground"
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
          />
          <YAxis 
            type="category"
            dataKey="plan_name"
            className="text-xs fill-muted-foreground"
            axisLine={false}
            tickLine={false}
            width={80}
          />
          <Tooltip 
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                return (
                  <div className="bg-popover border rounded-lg p-3 shadow-lg">
                    <p className="text-sm font-medium">{item.plan_name}</p>
                    <p className="text-lg font-bold text-primary">
                      {formatCurrency(item.revenue)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.count} usuários • {item.percentage.toFixed(1)}% do MRR
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar 
            dataKey="revenue" 
            fill="hsl(var(--primary))" 
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RevenueByPlanChart;
