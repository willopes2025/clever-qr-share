import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useCampaignDispatchMetrics, DateRange, CustomDateRange } from '@/hooks/useDashboardMetricsV2';
import { Send, CheckCheck, XCircle, Clock, Megaphone } from 'lucide-react';

interface CampaignDispatchSectionProps {
  dateRange: DateRange;
  customRange?: CustomDateRange;
}

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; className: string }> = {
    sending: { label: 'Enviando', className: 'bg-blue-500/20 text-blue-600 border-blue-500/30' },
    completed: { label: 'Concluída', className: 'bg-green-500/20 text-green-600 border-green-500/30' },
    scheduled: { label: 'Agendada', className: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30' },
    failed: { label: 'Falhou', className: 'bg-red-500/20 text-red-600 border-red-500/30' },
    cancelled: { label: 'Cancelada', className: 'bg-muted text-muted-foreground' },
    draft: { label: 'Rascunho', className: 'bg-muted text-muted-foreground' },
  };
  const s = map[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
};

export const CampaignDispatchSection = ({ dateRange, customRange }: CampaignDispatchSectionProps) => {
  const { data, isLoading } = useCampaignDispatchMetrics(dateRange, customRange);

  const summaryCards = [
    { label: 'Campanhas', value: data?.totalCampaigns || 0, icon: Megaphone, color: 'text-primary' },
    { label: 'Msgs Enviadas', value: data?.totalMessagesSent || 0, icon: Send, color: 'text-blue-500' },
    { label: 'Msgs Entregues', value: data?.totalMessagesDelivered || 0, icon: CheckCheck, color: 'text-green-500' },
    { label: 'Msgs Falhadas', value: data?.totalMessagesFailed || 0, icon: XCircle, color: 'text-red-500' },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          🚀 Disparos / Campanhas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {summaryCards.map((card, index) => (
            <div key={index} className="flex items-center gap-2 p-2 rounded-lg border bg-card">
              <card.icon className={`h-4 w-4 ${card.color}`} />
              <div className="flex flex-col">
                {isLoading ? (
                  <Skeleton className="h-5 w-10" />
                ) : (
                  <span className="font-semibold">{card.value.toLocaleString()}</span>
                )}
                <span className="text-xs text-muted-foreground">{card.label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Status breakdown */}
        <div className="flex flex-wrap gap-2">
          {data && (
            <>
              {data.sending > 0 && (
                <Badge variant="outline" className="bg-blue-500/20 text-blue-600 border-blue-500/30">
                  {data.sending} Enviando
                </Badge>
              )}
              {data.scheduled > 0 && (
                <Badge variant="outline" className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
                  {data.scheduled} Agendadas
                </Badge>
              )}
              {data.completed > 0 && (
                <Badge variant="outline" className="bg-green-500/20 text-green-600 border-green-500/30">
                  {data.completed} Concluídas
                </Badge>
              )}
              {data.failed > 0 && (
                <Badge variant="outline" className="bg-red-500/20 text-red-600 border-red-500/30">
                  {data.failed} Falharam
                </Badge>
              )}
              {data.totalMessagesQueued > 0 && (
                <Badge variant="outline" className="bg-orange-500/20 text-orange-600 border-orange-500/30">
                  <Clock className="h-3 w-3 mr-1" /> {data.totalMessagesQueued.toLocaleString()} Na fila
                </Badge>
              )}
            </>
          )}
        </div>

        {/* Recent campaigns list */}
        {data?.recentCampaigns && data.recentCampaigns.length > 0 && (
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground block">Campanhas recentes</span>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {data.recentCampaigns.map(campaign => (
                <div key={campaign.id} className="flex items-center justify-between p-2 rounded-lg border bg-card">
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-medium truncate">{campaign.name}</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{campaign.totalContacts} contatos</span>
                      <span>•</span>
                      <span className="text-green-600">{campaign.delivered} ✓</span>
                      {campaign.failed > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-red-600">{campaign.failed} ✗</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="ml-2 flex-shrink-0">
                    {statusBadge(campaign.status)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
