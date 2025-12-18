import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { BroadcastSend, BroadcastList } from "@/hooks/useBroadcastLists";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SendHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list: BroadcastList;
  sends: BroadcastSend[];
  isLoading: boolean;
}

const statusConfig = {
  pending: { label: "Pendente", icon: Clock, variant: "secondary" as const },
  sending: { label: "Enviando", icon: Loader2, variant: "default" as const },
  completed: { label: "Concluído", icon: CheckCircle2, variant: "default" as const },
  failed: { label: "Falhou", icon: XCircle, variant: "destructive" as const },
};

export const SendHistoryDialog = ({
  open,
  onOpenChange,
  list,
  sends,
  isLoading,
}: SendHistoryDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Histórico de Envios - {list.name}</DialogTitle>
          <DialogDescription>
            Visualize o histórico de envios realizados para esta lista.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {sends.map((send) => {
                const config = statusConfig[send.status as keyof typeof statusConfig] || statusConfig.pending;
                const Icon = config.icon;
                const successRate = send.total_contacts > 0
                  ? Math.round((send.delivered / send.total_contacts) * 100)
                  : 0;

                return (
                  <div
                    key={send.id}
                    className="p-4 border rounded-lg space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(send.sent_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                        </p>
                        <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
                          <Icon className={`h-3 w-3 ${send.status === "sending" ? "animate-spin" : ""}`} />
                          {config.label}
                        </Badge>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-medium">{send.total_contacts} contatos</p>
                        {send.status !== "pending" && (
                          <p className="text-muted-foreground">
                            {send.delivered} entregues • {send.failed} falhas
                          </p>
                        )}
                      </div>
                    </div>

                    <p className="text-sm bg-muted p-2 rounded line-clamp-3">
                      {send.message}
                    </p>

                    {send.status === "completed" && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${successRate}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{successRate}%</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {sends.length === 0 && (
                <p className="text-center py-8 text-muted-foreground">
                  Nenhum envio realizado para esta lista
                </p>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
