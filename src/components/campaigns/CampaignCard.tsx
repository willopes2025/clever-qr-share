import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Campaign } from '@/hooks/useCampaigns';
import { 
  Play, 
  Pause, 
  Trash2, 
  Edit2, 
  Clock, 
  Users, 
  MessageSquare,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CampaignCardProps {
  campaign: Campaign;
  onEdit: () => void;
  onDelete: () => void;
  onStart: () => void;
  onCancel: () => void;
  onTrack?: () => void;
}

const statusConfig = {
  draft: { label: 'Rascunho', variant: 'secondary' as const, icon: Edit2 },
  scheduled: { label: 'Agendada', variant: 'outline' as const, icon: Clock },
  sending: { label: 'Enviando', variant: 'default' as const, icon: Loader2 },
  completed: { label: 'Concluída', variant: 'default' as const, icon: CheckCircle2 },
  cancelled: { label: 'Cancelada', variant: 'destructive' as const, icon: XCircle },
};

export const CampaignCard = ({
  campaign,
  onEdit,
  onDelete,
  onStart,
  onCancel,
  onTrack,
}: CampaignCardProps) => {
  const status = statusConfig[campaign.status] || statusConfig.draft;
  const StatusIcon = status.icon;
  const progress = campaign.total_contacts > 0 
    ? Math.round((campaign.sent / campaign.total_contacts) * 100) 
    : 0;

  const canEdit = campaign.status === 'draft' || campaign.status === 'scheduled';
  const canStart = campaign.status === 'draft' || campaign.status === 'scheduled';
  const canCancel = campaign.status === 'sending';
  const canDelete = campaign.status !== 'sending';

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-1">
          <h3 className="font-semibold text-lg">{campaign.name}</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {campaign.scheduled_at && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {format(new Date(campaign.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
          </div>
        </div>
        <Badge 
          variant={status.variant}
          className="flex items-center gap-1"
        >
          <StatusIcon className={`h-3 w-3 ${campaign.status === 'sending' ? 'animate-spin' : ''}`} />
          {status.label}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Template:</span>
          <span className="font-medium truncate">
            {campaign.template?.name || 'Não definido'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Lista:</span>
          <span className="font-medium truncate">
            {campaign.list?.name || 'Não definida'}
          </span>
        </div>
      </div>

      {(campaign.status === 'sending' || campaign.status === 'completed') && (
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{campaign.sent} de {campaign.total_contacts} enviados</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                {campaign.delivered}
              </span>
              <span className="flex items-center gap-1 text-red-600">
                <XCircle className="h-3 w-3" />
                {campaign.failed}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-4 border-t">
        {canStart && (
          <Button size="sm" onClick={onStart} className="flex-1">
            <Play className="h-4 w-4 mr-2" />
            Iniciar
          </Button>
        )}
        {canCancel && (
          <Button size="sm" variant="destructive" onClick={onCancel} className="flex-1">
            <Pause className="h-4 w-4 mr-2" />
            Pausar
          </Button>
        )}
        {(campaign.status === 'sending' || campaign.status === 'completed') && onTrack && (
          <Button size="sm" variant="outline" onClick={onTrack} className="flex-1">
            Acompanhar
          </Button>
        )}
        {canEdit && (
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Edit2 className="h-4 w-4" />
          </Button>
        )}
        {canDelete && (
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
    </Card>
  );
};
