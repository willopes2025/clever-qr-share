import { useEffect, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, Bot, User, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { VoipCall, useVoipCalls } from "@/hooks/useVoipCalls";
import { motion } from "framer-motion";

interface ActiveCallPanelProps {
  call: VoipCall;
  isOpen: boolean;
  onClose: () => void;
  contactName?: string;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "Iniciando...", color: "text-muted-foreground" },
  ringing: { label: "Chamando...", color: "text-amber-500" },
  answered: { label: "Em ligação", color: "text-emerald-500" },
  completed: { label: "Finalizada", color: "text-muted-foreground" },
  failed: { label: "Falhou", color: "text-destructive" },
  no_answer: { label: "Não atendeu", color: "text-amber-500" },
  busy: { label: "Ocupado", color: "text-amber-500" },
};

export const ActiveCallPanel = ({
  call,
  isOpen,
  onClose,
  contactName,
}: ActiveCallPanelProps) => {
  const { endCall } = useVoipCalls();
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // Duration timer
  useEffect(() => {
    if (call.status !== 'answered') {
      setDuration(0);
      return;
    }

    const startTime = call.answered_at 
      ? new Date(call.answered_at).getTime() 
      : Date.now();

    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [call.status, call.answered_at]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = async () => {
    await endCall.mutateAsync(call.id);
    onClose();
  };

  const status = statusLabels[call.status] || statusLabels.pending;
  const isActive = ['pending', 'ringing', 'answered'].includes(call.status);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Chamada em Andamento
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Call Status Card */}
          <div className="bg-card border rounded-lg p-6 text-center space-y-4">
            {/* Avatar */}
            <motion.div
              animate={call.status === 'ringing' ? { scale: [1, 1.1, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1 }}
              className={cn(
                "mx-auto w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold",
                call.ai_enabled 
                  ? "bg-gradient-to-br from-primary/80 to-primary text-primary-foreground"
                  : "bg-gradient-to-br from-emerald-500/80 to-emerald-600 text-white"
              )}
            >
              {call.ai_enabled ? (
                <Bot className="h-10 w-10" />
              ) : (
                (contactName || call.called)?.[0]?.toUpperCase() || <User className="h-10 w-10" />
              )}
            </motion.div>

            {/* Contact Info */}
            <div>
              <h3 className="text-lg font-semibold">
                {contactName || call.called}
              </h3>
              <p className="text-sm text-muted-foreground">{call.called}</p>
            </div>

            {/* Status */}
            <div className="flex items-center justify-center gap-2">
              <Badge variant="outline" className={cn("gap-1", status.color)}>
                {call.status === 'answered' && (
                  <Clock className="h-3 w-3" />
                )}
                {status.label}
              </Badge>
              {call.ai_enabled && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  <Bot className="h-3 w-3 mr-1" />
                  IA
                </Badge>
              )}
            </div>

            {/* Duration */}
            {call.status === 'answered' && (
              <div className="text-3xl font-mono font-bold text-primary">
                {formatDuration(duration)}
              </div>
            )}
          </div>

          {/* AI Transcript (if AI enabled) */}
          {call.ai_enabled && call.ai_transcript && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Transcrição da IA
              </h4>
              <ScrollArea className="h-40 rounded-lg border bg-muted/30 p-3">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {call.ai_transcript}
                </p>
              </ScrollArea>
            </div>
          )}

          {/* Call Controls */}
          {isActive && (
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                className="h-14 w-14 rounded-full"
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? (
                  <MicOff className="h-6 w-6 text-destructive" />
                ) : (
                  <Mic className="h-6 w-6" />
                )}
              </Button>

              <Button
                variant="destructive"
                size="icon"
                className="h-16 w-16 rounded-full"
                onClick={handleEndCall}
                disabled={endCall.isPending}
              >
                <PhoneOff className="h-7 w-7" />
              </Button>
            </div>
          )}

          {/* Call Info */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>De: {call.caller}</p>
            <p>Para: {call.called}</p>
            {call.device_id && <p>Linha: {call.device_id}</p>}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
