import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Campaign, useCampaignRealtime } from '@/hooks/useCampaigns';
import { CheckCircle2, XCircle, Loader2, Send, Users, Clock, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CampaignTrackerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: Campaign | null;
}

interface CampaignMessage {
  id: string;
  phone: string;
  contact_name: string | null;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

export const CampaignTracker = ({
  open,
  onOpenChange,
  campaign,
}: CampaignTrackerProps) => {
  useCampaignRealtime(campaign?.id || null);
  
  const [elapsedTime, setElapsedTime] = useState(0);

  // Fetch campaign messages
  const { data: messages, refetch } = useQuery({
    queryKey: ['campaign-messages-detail', campaign?.id],
    queryFn: async () => {
      if (!campaign?.id) return [];
      
      const { data, error } = await supabase
        .from('campaign_messages')
        .select('id, phone, contact_name, status, sent_at, error_message, created_at')
        .eq('campaign_id', campaign.id)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as CampaignMessage[];
    },
    enabled: !!campaign?.id && open,
    refetchInterval: campaign?.status === 'sending' ? 3000 : false,
  });

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

  // Refetch messages when campaign updates
  useEffect(() => {
    if (campaign?.status === 'sending') {
      refetch();
    }
  }, [campaign?.sent, campaign?.status, refetch]);

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

  // Categorize messages
  const sentMessages = messages?.filter(m => m.status === 'sent' || m.status === 'delivered') || [];
  const queuedMessages = messages?.filter(m => m.status === 'queued' || m.status === 'sending') || [];
  const failedMessages = messages?.filter(m => m.status === 'failed') || [];

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    if (cleaned.length === 12 && cleaned.startsWith('55')) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
    }
    return phone;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return <Badge variant="default" className="bg-green-600">Enviado</Badge>;
      case 'failed':
        return <Badge variant="destructive">Falhou</Badge>;
      case 'queued':
        return <Badge variant="secondary">Na Fila</Badge>;
      case 'sending':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-500">Enviando</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {campaign.status === 'sending' && (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            )}
            {campaign.status === 'completed' && (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            )}
            {(campaign.status === 'cancelled' || campaign.status === 'failed') && (
              <AlertCircle className="h-5 w-5 text-destructive" />
            )}
            {campaign.name}
          </DialogTitle>
          <DialogDescription>
            Acompanhe o progresso e veja detalhes de cada mensagem.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Progress */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Progresso do Envio</span>
              <span className="text-2xl font-bold">{progress}%</span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xl font-bold">{campaign.total_contacts}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <Send className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-xl font-bold">{campaign.sent}</p>
              <p className="text-xs text-muted-foreground">Enviados</p>
            </div>
            <div className="bg-green-500/10 rounded-lg p-3 text-center">
              <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-green-600" />
              <p className="text-xl font-bold text-green-600">{campaign.delivered}</p>
              <p className="text-xs text-muted-foreground">Entregues</p>
            </div>
            <div className="bg-red-500/10 rounded-lg p-3 text-center">
              <XCircle className="h-5 w-5 mx-auto mb-1 text-red-600" />
              <p className="text-xl font-bold text-red-600">{campaign.failed}</p>
              <p className="text-xs text-muted-foreground">Falhas</p>
            </div>
          </div>

          {/* Time Stats */}
          {campaign.status === 'sending' && (
            <div className="flex items-center justify-between text-sm border-t border-b py-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
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
            <div className="text-sm text-center text-muted-foreground border-t border-b py-3">
              Campanha concluída em{' '}
              <span className="font-medium">
                {formatTime(
                  Math.floor(
                    (new Date(campaign.completed_at).getTime() - 
                     new Date(campaign.started_at).getTime()) / 1000
                  )
                )}
              </span>
            </div>
          )}

          {/* Messages Detail Tabs */}
          <Tabs defaultValue="sent" className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="sent" className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Enviadas ({sentMessages.length})
              </TabsTrigger>
              <TabsTrigger value="queued" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Na Fila ({queuedMessages.length})
              </TabsTrigger>
              <TabsTrigger value="failed" className="flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Falhas ({failedMessages.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="sent" className="flex-1 mt-2 min-h-0">
              <ScrollArea className="h-[200px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="w-[100px]">Enviado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sentMessages.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          Nenhuma mensagem enviada ainda
                        </TableCell>
                      </TableRow>
                    ) : (
                      sentMessages.map(msg => (
                        <TableRow key={msg.id}>
                          <TableCell className="font-medium">{msg.contact_name || '-'}</TableCell>
                          <TableCell className="font-mono text-sm">{formatPhone(msg.phone)}</TableCell>
                          <TableCell className="text-sm">
                            {msg.sent_at ? format(new Date(msg.sent_at), 'HH:mm:ss', { locale: ptBR }) : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="queued" className="flex-1 mt-2 min-h-0">
              <ScrollArea className="h-[200px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queuedMessages.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          Nenhuma mensagem na fila
                        </TableCell>
                      </TableRow>
                    ) : (
                      queuedMessages.map(msg => (
                        <TableRow key={msg.id}>
                          <TableCell className="font-medium">{msg.contact_name || '-'}</TableCell>
                          <TableCell className="font-mono text-sm">{formatPhone(msg.phone)}</TableCell>
                          <TableCell>{getStatusBadge(msg.status)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="failed" className="flex-1 mt-2 min-h-0">
              <ScrollArea className="h-[200px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[150px]">Nome</TableHead>
                      <TableHead className="w-[130px]">Telefone</TableHead>
                      <TableHead>Erro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {failedMessages.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          Nenhuma falha de envio
                        </TableCell>
                      </TableRow>
                    ) : (
                      failedMessages.map(msg => (
                        <TableRow key={msg.id}>
                          <TableCell className="font-medium">{msg.contact_name || '-'}</TableCell>
                          <TableCell className="font-mono text-sm">{formatPhone(msg.phone)}</TableCell>
                          <TableCell className="text-sm text-destructive truncate max-w-[200px]" title={msg.error_message || undefined}>
                            {msg.error_message || 'Erro desconhecido'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};
