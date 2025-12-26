import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Loader2, Download, CheckCircle, Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useSyncHistory } from '@/hooks/useSyncHistory';
import { useAuth } from '@/hooks/useAuth';

interface SyncHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceName: string;
  onSuccess?: () => void;
}

export function SyncHistoryDialog({ 
  open, 
  onOpenChange, 
  instanceName,
  onSuccess,
}: SyncHistoryDialogProps) {
  const [syncDate, setSyncDate] = useState<Date | undefined>(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Default: 7 days ago
  );
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    messages: number;
    contacts: number;
    conversations: number;
  } | null>(null);

  const { syncHistory, progress, isSyncing } = useSyncHistory();
  const { user } = useAuth();

  const handleSync = async () => {
    if (!syncDate || !user) return;

    setSyncResult(null);
    
    const result = await syncHistory.mutateAsync({
      instanceName,
      startDate: syncDate.toISOString(),
      userId: user.id,
    });

    if (result.success && result.synced) {
      setSyncResult({
        messages: result.synced.messages,
        contacts: result.synced.contacts,
        conversations: result.synced.conversations,
      });
      onSuccess?.();
    }
  };

  const handleClose = () => {
    if (!isSyncing) {
      setSyncResult(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="glass-card border-neon-cyan/30 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-glow-cyan flex items-center gap-2">
            <Download className="h-5 w-5" />
            Sincronizar Histórico de Mensagens
          </DialogTitle>
          <DialogDescription>
            Importe mensagens anteriores do WhatsApp para a instância "{instanceName}".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!syncResult ? (
            <>
              <div className="space-y-2">
                <Label>Data Inicial</Label>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal neon-border',
                        !syncDate && 'text-muted-foreground'
                      )}
                      disabled={isSyncing}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {syncDate ? (
                        format(syncDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                      ) : (
                        'Selecione uma data'
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={syncDate}
                      onSelect={(date) => {
                        setSyncDate(date);
                        setCalendarOpen(false);
                      }}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  Serão importadas mensagens a partir desta data até hoje.
                </p>
              </div>

              {isSyncing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Sincronizando...</span>
                    <span className="text-neon-cyan">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              <div className="bg-muted/30 rounded-lg p-3 text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">ℹ️ Importante:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>O histórico depende das mensagens disponíveis no celular conectado</li>
                  <li>Mensagens apagadas do celular não estarão disponíveis</li>
                  <li>Mensagens duplicadas serão ignoradas automaticamente</li>
                  <li>O processo pode levar alguns minutos dependendo do volume</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={handleClose} 
                  className="flex-1 neon-border"
                  disabled={isSyncing}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSync}
                  disabled={isSyncing || !syncDate}
                  className="flex-1 bg-gradient-neon"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Iniciar Sincronização
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-accent/20 text-accent">
                <CheckCircle className="h-8 w-8" />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Sincronização Concluída!
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  O histórico de mensagens foi importado com sucesso.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 py-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-neon-cyan">
                    {syncResult.messages}
                  </div>
                  <div className="text-xs text-muted-foreground">Mensagens</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-neon-purple">
                    {syncResult.contacts}
                  </div>
                  <div className="text-xs text-muted-foreground">Novos Contatos</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-accent">
                    {syncResult.conversations}
                  </div>
                  <div className="text-xs text-muted-foreground">Conversas</div>
                </div>
              </div>

              <Button onClick={handleClose} className="w-full bg-gradient-neon">
                Fechar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
