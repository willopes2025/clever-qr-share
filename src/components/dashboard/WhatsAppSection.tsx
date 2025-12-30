import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useWhatsAppMetrics, DateRange } from '@/hooks/useDashboardMetricsV2';
import { Send, CheckCheck, XCircle, Percent, Smartphone } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

interface WhatsAppSectionProps {
  dateRange: DateRange;
}

export const WhatsAppSection = ({ dateRange }: WhatsAppSectionProps) => {
  const { data, isLoading } = useWhatsAppMetrics(dateRange);

  const metrics = [
    { title: 'Enviadas', value: data?.messagesSent || 0, icon: Send, color: 'text-blue-500' },
    { title: 'Entregues', value: data?.messagesDelivered || 0, icon: CheckCheck, color: 'text-green-500' },
    { title: 'Falhadas', value: data?.messagesFailed || 0, icon: XCircle, color: 'text-red-500' },
    { title: 'Taxa Entrega', value: `${(data?.deliveryRate || 0).toFixed(1)}%`, icon: Percent, color: 'text-emerald-500', isText: true },
  ];

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          💬 WhatsApp / Mensagens
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {metrics.map((metric, index) => (
            <div key={index} className="flex items-center gap-2 p-2 rounded-lg border bg-card">
              <metric.icon className={`h-4 w-4 ${metric.color}`} />
              <div className="flex flex-col">
                {isLoading ? (
                  <Skeleton className="h-5 w-10" />
                ) : (
                  <span className="font-semibold">
                    {metric.isText ? metric.value : metric.value.toLocaleString()}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{metric.title}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Chips Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Chips:</span>
          </div>
          <Badge variant="default" className="bg-green-500/20 text-green-600 border-green-500/30">
            {data?.activeChips || 0} Ativos
          </Badge>
          <Badge variant="secondary" className="bg-red-500/20 text-red-600 border-red-500/30">
            {data?.inactiveChips || 0} Inativos
          </Badge>
        </div>

        {/* Messages by Instance Chart */}
        {data?.messagesByInstance && data.messagesByInstance.length > 0 && (
          <div className="h-40">
            <span className="text-sm text-muted-foreground mb-2 block">Mensagens por Chip</span>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.messagesByInstance} layout="vertical">
                <XAxis type="number" hide />
                <YAxis 
                  type="category" 
                  dataKey="instanceName" 
                  width={100}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip 
                  formatter={(value: number) => [value.toLocaleString(), 'Mensagens']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))' 
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
