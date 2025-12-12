import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Campaign {
  id: string;
  name: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  sent: number;
  delivered: number;
  failed: number;
  total_contacts: number;
}

interface RecentCampaignsProps {
  campaigns: Campaign[];
  isLoading?: boolean;
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'completed':
      return { icon: CheckCircle, label: 'Concluída', variant: 'default' as const, className: 'bg-green-500/10 text-green-600 border-green-500/20' };
    case 'sending':
      return { icon: Loader2, label: 'Enviando', variant: 'secondary' as const, className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' };
    case 'scheduled':
      return { icon: Clock, label: 'Agendada', variant: 'outline' as const, className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' };
    case 'failed':
      return { icon: XCircle, label: 'Falhou', variant: 'destructive' as const, className: 'bg-red-500/10 text-red-600 border-red-500/20' };
    default:
      return { icon: Send, label: 'Rascunho', variant: 'outline' as const, className: '' };
  }
};

export const RecentCampaigns = ({ campaigns, isLoading }: RecentCampaignsProps) => {
  if (isLoading) {
    return (
      <Card className="p-6 shadow-medium">
        <h3 className="text-xl font-semibold mb-4">Campanhas Recentes</h3>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 shadow-medium">
      <h3 className="text-xl font-semibold mb-4">Campanhas Recentes</h3>
      <div className="space-y-4">
        {campaigns.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Nenhuma campanha encontrada
          </p>
        ) : (
          campaigns.map((campaign) => {
            const config = getStatusConfig(campaign.status);
            const StatusIcon = config.icon;
            const timestamp = campaign.completed_at || campaign.started_at;
            
            return (
              <div
                key={campaign.id}
                className="flex items-start gap-3 pb-4 border-b border-border last:border-0 last:pb-0"
              >
                <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center shrink-0">
                  <Send className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium truncate">{campaign.name}</p>
                    <Badge variant={config.variant} className={config.className}>
                      <StatusIcon className={`h-3 w-3 mr-1 ${campaign.status === 'sending' ? 'animate-spin' : ''}`} />
                      {config.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{campaign.total_contacts} contatos</span>
                    {campaign.delivered > 0 && (
                      <span className="text-green-600">{campaign.delivered} entregues</span>
                    )}
                    {campaign.failed > 0 && (
                      <span className="text-red-600">{campaign.failed} falhas</span>
                    )}
                  </div>
                  {timestamp && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: ptBR })}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};
