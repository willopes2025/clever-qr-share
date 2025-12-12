import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { CampaignChartData } from "@/hooks/useDashboardMetrics";

interface CampaignChartProps {
  data: CampaignChartData[];
  isLoading?: boolean;
}

export const CampaignChart = ({ data, isLoading }: CampaignChartProps) => {
  if (isLoading) {
    return (
      <Card className="p-6 shadow-medium">
        <h3 className="text-xl font-semibold mb-4">Mensagens - Últimos 7 dias</h3>
        <div className="h-64 bg-muted animate-pulse rounded" />
      </Card>
    );
  }

  return (
    <Card className="p-6 shadow-medium">
      <h3 className="text-xl font-semibold mb-4">Mensagens - Últimos 7 dias</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }} 
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              tick={{ fontSize: 12 }} 
              tickLine={false}
              axisLine={false}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Bar 
              dataKey="delivered" 
              name="Entregues" 
              fill="hsl(142.1 76.2% 36.3%)" 
              radius={[4, 4, 0, 0]}
            />
            <Bar 
              dataKey="sent" 
              name="Enviados" 
              fill="hsl(var(--primary))" 
              radius={[4, 4, 0, 0]}
            />
            <Bar 
              dataKey="failed" 
              name="Falhas" 
              fill="hsl(0 84.2% 60.2%)" 
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
