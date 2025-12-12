import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Campaign, useCampaignRealtime } from '@/hooks/useCampaigns';
import { CheckCircle2, XCircle, Loader2, Send, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

interface CampaignTrackerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: Campaign | null;
}

export const CampaignTracker = ({
  open,
  onOpenChange,
  campaign,
}: CampaignTrackerProps) => {
  useCampaignRealtime(campaign?.id || null);
  
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!campaign?.started_at || campaign.status !== 'sending') {
      setElapsedTime(0);
      return;
    }

    const startTime = new Date(campaign.started_at).getTime();
    
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [campaign?.started_at, campaign?.status]);

  if (!campaign) return null;

  const progress = campaign.total_contacts > 0 
    ? Math.round((campaign.sent / campaign.total_contacts) * 100) 
    : 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const estimatedRemaining = campaign.sent > 0 && campaign.status === 'sending'
    ? Math.round(((campaign.total_contacts - campaign.sent) / campaign.sent) * elapsedTime)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {campaign.status === 'sending' && (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            )}
            {campaign.status === 'completed' && (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            )}
            {campaign.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Progress */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Progresso do Envio</span>
              <span className="text-2xl font-bold">{progress}%</span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <Users className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-2xl font-bold">{campaign.total_contacts}</p>
              <p className="text-sm text-muted-foreground">Total de Contatos</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <Send className="h-6 w-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{campaign.sent}</p>
              <p className="text-sm text-muted-foreground">Mensagens Enviadas</p>
            </div>
            <div className="bg-green-500/10 rounded-lg p-4 text-center">
              <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-green-600" />
              <p className="text-2xl font-bold text-green-600">{campaign.delivered}</p>
              <p className="text-sm text-muted-foreground">Entregues</p>
            </div>
            <div className="bg-red-500/10 rounded-lg p-4 text-center">
              <XCircle className="h-6 w-6 mx-auto mb-2 text-red-600" />
              <p className="text-2xl font-bold text-red-600">{campaign.failed}</p>
              <p className="text-sm text-muted-foreground">Falhas</p>
            </div>
          </div>

          {/* Time Stats */}
          {campaign.status === 'sending' && (
            <div className="flex items-center justify-between text-sm border-t pt-4">
              <div>
                <span className="text-muted-foreground">Tempo decorrido: </span>
                <span className="font-medium">{formatTime(elapsedTime)}</span>
              </div>
              {estimatedRemaining > 0 && (
                <div>
                  <span className="text-muted-foreground">Tempo restante: </span>
                  <span className="font-medium">~{formatTime(estimatedRemaining)}</span>
                </div>
              )}
            </div>
          )}

          {campaign.status === 'completed' && campaign.completed_at && campaign.started_at && (
            <div className="text-sm text-center text-muted-foreground border-t pt-4">
              Campanha concluída em{' '}
              {formatTime(
                Math.floor(
                  (new Date(campaign.completed_at).getTime() - 
                   new Date(campaign.started_at).getTime()) / 1000
                )
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
