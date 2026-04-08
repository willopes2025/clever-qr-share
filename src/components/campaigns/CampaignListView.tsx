import { Campaign } from '@/hooks/useCampaigns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Play, Pause, Trash2, Edit2, Clock, Users, CheckCircle2, XCircle,
  Loader2, Calendar, RotateCcw, Send, Ban, MoreVertical, BarChart2
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CampaignListViewProps {
  campaigns: Campaign[];
  onEdit: (campaign: Campaign) => void;
  onDelete: (campaign: Campaign) => void;
  onStart: (campaign: Campaign) => void;
  onCancel: (campaign: Campaign) => void;
  onTrack: (campaign: Campaign) => void;
  onResume: (campaign: Campaign) => void;
}

const statusConfig = {
  draft: { label: 'Rascunho', variant: 'secondary' as const, icon: Edit2 },
  scheduled: { label: 'Agendada', variant: 'outline' as const, icon: Clock },
  sending: { label: 'Enviando', variant: 'default' as const, icon: Loader2 },
  completed: { label: 'Concluída', variant: 'default' as const, icon: CheckCircle2 },
  cancelled: { label: 'Cancelada', variant: 'destructive' as const, icon: XCircle },
  failed: { label: 'Falhou', variant: 'destructive' as const, icon: XCircle },
};

export const CampaignListView = ({
  campaigns, onEdit, onDelete, onStart, onCancel, onTrack, onResume,
}: CampaignListViewProps) => {
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-sm text-muted-foreground">
            <th className="px-4 py-3 font-medium">Nome</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium hidden md:table-cell">Template</th>
            <th className="px-4 py-3 font-medium hidden md:table-cell">Lista</th>
            <th className="px-4 py-3 font-medium hidden lg:table-cell">Progresso</th>
            <th className="px-4 py-3 font-medium hidden lg:table-cell">Enviados</th>
            <th className="px-4 py-3 font-medium hidden xl:table-cell">Entregues</th>
            <th className="px-4 py-3 font-medium hidden xl:table-cell">Falhas</th>
            <th className="px-4 py-3 font-medium text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => {
            const status = statusConfig[campaign.status] || statusConfig.draft;
            const StatusIcon = status.icon;
            const progress = campaign.total_contacts > 0
              ? Math.round((campaign.sent / campaign.total_contacts) * 100)
              : 0;
            const canEdit = campaign.status !== 'sending';
            const canStart = campaign.status === 'draft' || campaign.status === 'scheduled';
            const canCancel = campaign.status === 'sending';
            const canDelete = campaign.status !== 'sending';
            const canResume = campaign.status === 'cancelled' || campaign.status === 'failed' ||
              (campaign.status === 'completed' && campaign.sent < campaign.total_contacts);
            const canTrack = ['sending', 'completed', 'cancelled', 'failed'].includes(campaign.status);

            return (
              <tr key={campaign.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div>
                    <span className="font-medium">{campaign.name}</span>
                    {campaign.scheduled_at && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(campaign.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={status.variant} className="flex items-center gap-1 w-fit">
                    <StatusIcon className={`h-3 w-3 ${campaign.status === 'sending' ? 'animate-spin' : ''}`} />
                    {status.label}
                  </Badge>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-sm truncate max-w-[150px] block">
                    {campaign.template?.name || '—'}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-sm truncate max-w-[150px] block">
                    {campaign.list?.name || '—'}
                  </span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell w-[120px]">
                  {campaign.total_contacts > 0 ? (
                    <div className="flex items-center gap-2">
                      <Progress value={progress} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground w-8">{progress}%</span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-sm flex items-center gap-1">
                    <Send className="h-3 w-3 text-blue-500" />
                    {campaign.sent}/{campaign.total_contacts}
                  </span>
                </td>
                <td className="px-4 py-3 hidden xl:table-cell">
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {campaign.delivered}
                  </span>
                </td>
                <td className="px-4 py-3 hidden xl:table-cell">
                  <span className="text-sm text-red-600 flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    {campaign.failed}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canStart && (
                        <DropdownMenuItem onClick={() => onStart(campaign)}>
                          <Play className="h-4 w-4 mr-2" /> Iniciar
                        </DropdownMenuItem>
                      )}
                      {canResume && (
                        <DropdownMenuItem onClick={() => onResume(campaign)}>
                          <RotateCcw className="h-4 w-4 mr-2" /> Retomar
                        </DropdownMenuItem>
                      )}
                      {canCancel && (
                        <DropdownMenuItem onClick={() => onCancel(campaign)}>
                          <Pause className="h-4 w-4 mr-2" /> Pausar
                        </DropdownMenuItem>
                      )}
                      {canTrack && (
                        <DropdownMenuItem onClick={() => onTrack(campaign)}>
                          <BarChart2 className="h-4 w-4 mr-2" /> Acompanhar
                        </DropdownMenuItem>
                      )}
                      {canEdit && (
                        <DropdownMenuItem onClick={() => onEdit(campaign)}>
                          <Edit2 className="h-4 w-4 mr-2" /> Editar
                        </DropdownMenuItem>
                      )}
                      {canDelete && (
                        <DropdownMenuItem onClick={() => onDelete(campaign)} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
