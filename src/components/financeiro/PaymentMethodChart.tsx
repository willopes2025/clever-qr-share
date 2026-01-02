import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { PaymentMethodStats } from '@/hooks/useFinancialMetrics';
import { CreditCard, QrCode, FileText, MoreHorizontal } from 'lucide-react';

interface PaymentMethodChartProps {
  data: PaymentMethodStats;
  isLoading?: boolean;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const COLORS = {
  pix: '#22c55e',      // green
  boleto: '#f59e0b',   // amber
  creditCard: '#3b82f6', // blue
  other: '#6b7280',    // gray
};

const LABELS = {
  pix: 'PIX',
  boleto: 'Boleto',
  creditCard: 'Cartão',
  other: 'Outros',
};

const ICONS = {
  pix: QrCode,
  boleto: FileText,
  creditCard: CreditCard,
  other: MoreHorizontal,
};

export const PaymentMethodChart = ({ data, isLoading = false }: PaymentMethodChartProps) => {
  const chartData = Object.entries(data)
    .filter(([_, stats]) => stats.value > 0)
    .map(([key, stats]) => ({
      name: LABELS[key as keyof typeof LABELS],
      value: stats.value,
      count: stats.count,
      color: COLORS[key as keyof typeof COLORS],
      key,
    }));

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Métodos de Pagamento</CardTitle>
          <CardDescription>Distribuição por forma de pagamento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            <p className="text-sm">Sem dados no período</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Métodos de Pagamento</CardTitle>
        <CardDescription>Distribuição por forma de pagamento</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const percentage = ((data.value / total) * 100).toFixed(1);
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <p className="text-sm font-medium">{data.name}</p>
                        <p className="text-sm font-bold">{formatCurrency(data.value)}</p>
                        <p className="text-xs text-muted-foreground">
                          {data.count} cobranças ({percentage}%)
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          {chartData.map((item) => {
            const Icon = ICONS[item.key as keyof typeof ICONS];
            const percentage = ((item.value / total) * 100).toFixed(0);
            
            return (
              <div key={item.key} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <Icon className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs flex-1">{item.name}</span>
                <span className="text-xs font-medium">{percentage}%</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
