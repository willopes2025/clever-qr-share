import { Card } from "@/components/ui/card";
import { Clock, Calendar, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ScheduledCampaign {
  id: string;
  name: string;
  scheduled_at: string | null;
  total_contacts: number;
  broadcast_lists?: { name: string } | null;
}

interface ScheduledCampaignsProps {
  campaigns: ScheduledCampaign[];
  isLoading?: boolean;
}

export const ScheduledCampaigns = ({ campaigns, isLoading }: ScheduledCampaignsProps) => {
  if (isLoading) {
    return (
      <Card className="p-6 shadow-medium">
        <h3 className="text-xl font-semibold mb-4">Próximas Campanhas</h3>
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
      <h3 className="text-xl font-semibold mb-4">Próximas Campanhas</h3>
      <div className="space-y-4">
        {campaigns.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Nenhuma campanha agendada
          </p>
        ) : (
          campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="flex items-start gap-3 pb-4 border-b border-border last:border-0 last:pb-0"
            >
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate mb-1">{campaign.name}</p>
                {campaign.scheduled_at && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {format(new Date(campaign.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {campaign.total_contacts} contatos
                  </span>
                  {campaign.broadcast_lists?.name && (
                    <span>Lista: {campaign.broadcast_lists.name}</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};
