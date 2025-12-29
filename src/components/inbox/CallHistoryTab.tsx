import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Bot, Clock, Play, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useVoipCalls, VoipCall } from "@/hooks/useVoipCalls";
import { useState } from "react";

interface CallHistoryTabProps {
  contactId?: string;
  conversationId?: string;
}

const statusConfig: Record<string, { icon: typeof Phone; color: string; label: string }> = {
  completed: { icon: Phone, color: "text-emerald-500", label: "Completada" },
  answered: { icon: Phone, color: "text-emerald-500", label: "Em andamento" },
  failed: { icon: PhoneMissed, color: "text-destructive", label: "Falhou" },
  no_answer: { icon: PhoneMissed, color: "text-amber-500", label: "Não atendida" },
  busy: { icon: PhoneMissed, color: "text-amber-500", label: "Ocupado" },
  pending: { icon: Phone, color: "text-muted-foreground", label: "Iniciando" },
  ringing: { icon: Phone, color: "text-amber-500", label: "Chamando" },
};

export const CallHistoryTab = ({ contactId, conversationId }: CallHistoryTabProps) => {
  const { calls, isLoading } = useVoipCalls(contactId, conversationId);
  const [selectedCall, setSelectedCall] = useState<VoipCall | null>(null);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Phone className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">Nenhuma chamada registrada</p>
        <p className="text-xs text-muted-foreground mt-1">
          As chamadas realizadas aparecerão aqui
        </p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="h-full">
        <div className="space-y-2 p-2">
          {calls.map((call) => {
            const config = statusConfig[call.status] || statusConfig.pending;
            const DirectionIcon = call.direction === 'inbound' ? PhoneIncoming : PhoneOutgoing;

            return (
              <div
                key={call.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => setSelectedCall(call)}
              >
                {/* Icon */}
                <div className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full",
                  call.ai_enabled ? "bg-primary/10" : "bg-muted"
                )}>
                  {call.ai_enabled ? (
                    <Bot className={cn("h-5 w-5", config.color)} />
                  ) : (
                    <DirectionIcon className={cn("h-5 w-5", config.color)} />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">
                      {call.direction === 'inbound' ? call.caller : call.called}
                    </span>
                    {call.ai_enabled && (
                      <Badge variant="outline" className="text-[10px] px-1">
                        IA
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={config.color}>{config.label}</span>
                    <span>•</span>
                    <span>{formatDistanceToNow(new Date(call.created_at), { 
                      addSuffix: true, 
                      locale: ptBR 
                    })}</span>
                  </div>
                </div>

                {/* Duration */}
                <div className="text-right shrink-0">
                  <div className="flex items-center gap-1 text-sm font-mono">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    {formatDuration(call.duration_seconds)}
                  </div>
                  {call.recording_url && (
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                      <Play className="h-3 w-3 mr-1" />
                      Ouvir
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Call Details Dialog */}
      <Dialog open={!!selectedCall} onOpenChange={() => setSelectedCall(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Detalhes da Chamada
            </DialogTitle>
            <DialogDescription>
              {selectedCall && format(new Date(selectedCall.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </DialogDescription>
          </DialogHeader>

          {selectedCall && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">De</p>
                  <p className="font-medium">{selectedCall.caller}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Para</p>
                  <p className="font-medium">{selectedCall.called}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant="outline" className={statusConfig[selectedCall.status]?.color}>
                    {statusConfig[selectedCall.status]?.label || selectedCall.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Duração</p>
                  <p className="font-mono">{formatDuration(selectedCall.duration_seconds)}</p>
                </div>
              </div>

              {/* Recording */}
              {selectedCall.recording_url && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Gravação</p>
                  <audio 
                    controls 
                    className="w-full" 
                    src={selectedCall.recording_url}
                  />
                </div>
              )}

              {/* AI Transcript */}
              {selectedCall.ai_transcript && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Transcrição da IA
                  </p>
                  <div className="bg-muted/30 rounded-lg p-3 text-sm whitespace-pre-wrap max-h-48 overflow-auto">
                    {selectedCall.ai_transcript}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
