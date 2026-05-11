import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Loader2, Smartphone } from 'lucide-react';
import { useWhatsAppInstances } from '@/hooks/useWhatsAppInstances';
import { useInboxHiddenInstances } from '@/hooks/useInboxHiddenInstances';

interface InboxVisibilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InboxVisibilityDialog({ open, onOpenChange }: InboxVisibilityDialogProps) {
  const { instances, isLoading } = useWhatsAppInstances();
  const { hiddenSet, setVisibility } = useInboxHiddenInstances();

  const visibleInstances = (instances || []).filter((i) => !i.is_notification_only);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Visibilidade na Inbox
          </DialogTitle>
          <DialogDescription>
            Escolha quais instâncias devem aparecer na sua caixa de entrada. Esta
            preferência é individual — só afeta a sua conta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : visibleInstances.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma instância encontrada.
            </p>
          ) : (
            visibleInstances.map((instance) => {
              const isHidden = hiddenSet.has(instance.id);
              return (
                <div
                  key={instance.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50 bg-card/40"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-md bg-primary/10 shrink-0">
                      <Smartphone className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{instance.instance_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-xs">
                          {instance.status === 'connected' ? 'Conectada' : 'Desconectada'}
                        </Badge>
                        {isHidden && (
                          <Badge variant="secondary" className="text-xs">
                            <EyeOff className="h-3 w-3 mr-1" />
                            Oculta
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={!isHidden}
                    disabled={setVisibility.isPending}
                    onCheckedChange={(checked) =>
                      setVisibility.mutate({ instanceId: instance.id, visible: checked })
                    }
                  />
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
