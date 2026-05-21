import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useWhatsAppMetrics, DateRange, CustomDateRange } from '@/hooks/useDashboardMetricsV2';
import { Send, CheckCheck, XCircle, Percent, Smartphone, ArrowDownLeft } from 'lucide-react';

interface WhatsAppSectionProps {
  dateRange: DateRange;
  customRange?: CustomDateRange;
}

export const WhatsAppSection = ({ dateRange, customRange }: WhatsAppSectionProps) => {
  const { data, isLoading } = useWhatsAppMetrics(dateRange, customRange);

  const metrics = [
    { title: 'Enviadas', value: data?.messagesSent || 0, icon: Send, color: 'text-blue-500' },
    { title: 'Entregues', value: data?.messagesDelivered || 0, icon: CheckCheck, color: 'text-green-500' },
    { title: 'Falhadas', value: data?.messagesFailed || 0, icon: XCircle, color: 'text-red-500' },
    { title: 'Taxa Entrega', value: `${(data?.deliveryRate || 0).toFixed(1)}%`, icon: Percent, color: 'text-emerald-500', isText: true },
  ];

  const rows = data?.messagesByInstance || [];

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          💬 WhatsApp / Mensagens
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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

        <div>
          <span className="text-sm text-muted-foreground mb-2 block">Mensagens por Chip no período</span>
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map(i => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
              Nenhuma mensagem no período selecionado
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">Instância</th>
                    <th className="px-3 py-2 font-medium">
                      <span className="inline-flex items-center gap-1">
                        <Send className="h-3.5 w-3.5 text-blue-500" /> Enviadas
                      </span>
                    </th>
                    <th className="px-3 py-2 font-medium">
                      <span className="inline-flex items-center gap-1">
                        <CheckCheck className="h-3.5 w-3.5 text-green-500" /> Entregues
                      </span>
                    </th>
                    <th className="px-3 py-2 font-medium">
                      <span className="inline-flex items-center gap-1">
                        <ArrowDownLeft className="h-3.5 w-3.5 text-purple-500" /> Recebidas
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.instanceId} className="border-t">
                      <td className="px-3 py-2 truncate max-w-[200px]" title={row.instanceName}>
                        {row.instanceName}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{row.sent.toLocaleString()}</td>
                      <td className="px-3 py-2 tabular-nums">{row.delivered.toLocaleString()}</td>
                      <td className="px-3 py-2 tabular-nums">{row.received.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
