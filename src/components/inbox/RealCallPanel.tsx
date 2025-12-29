import { useState, useEffect } from "react";
import { Phone, PhoneOff, Loader2, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RealCallPanelProps {
  callId: string | null;
  contactName?: string;
  contactPhone: string;
  onEnd: () => void;
}

interface CallData {
  id: string;
  status: string;
  duration_seconds: number;
  transcript: string | null;
  error_message: string | null;
  created_at: string;
  ended_at: string | null;
}

export const RealCallPanel = ({
  callId,
  contactName,
  contactPhone,
  onEnd,
}: RealCallPanelProps) => {
  const [callData, setCallData] = useState<CallData | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Poll for call status updates
  useEffect(() => {
    if (!callId) return;

    const fetchCallData = async () => {
      const { data, error } = await supabase
        .from('ai_phone_calls')
        .select('*')
        .eq('id', callId)
        .single();

      if (!error && data) {
        setCallData(data as CallData);
      }
    };

    // Initial fetch
    fetchCallData();

    // Poll every 2 seconds
    const interval = setInterval(fetchCallData, 2000);

    return () => clearInterval(interval);
  }, [callId]);

  // Timer for call duration
  useEffect(() => {
    if (!callData || callData.status === 'completed' || callData.status === 'failed') {
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [callData?.status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'initiating':
        return {
          label: 'Iniciando',
          color: 'bg-blue-500',
          icon: Loader2,
          iconClass: 'animate-spin',
        };
      case 'ringing':
        return {
          label: 'Chamando',
          color: 'bg-amber-500',
          icon: Phone,
          iconClass: 'animate-pulse',
        };
      case 'connected':
        return {
          label: 'Em chamada',
          color: 'bg-emerald-500',
          icon: Phone,
          iconClass: '',
        };
      case 'completed':
        return {
          label: 'Finalizada',
          color: 'bg-green-500',
          icon: CheckCircle,
          iconClass: '',
        };
      case 'failed':
        return {
          label: 'Falhou',
          color: 'bg-red-500',
          icon: XCircle,
          iconClass: '',
        };
      default:
        return {
          label: status,
          color: 'bg-muted',
          icon: AlertCircle,
          iconClass: '',
        };
    }
  };

  const statusConfig = getStatusConfig(callData?.status || 'initiating');
  const StatusIcon = statusConfig.icon;
  const isCallEnded = callData?.status === 'completed' || callData?.status === 'failed';

  return (
    <div className="space-y-4 py-4">
      {/* Call Status */}
      <div className="flex flex-col items-center gap-4">
        <div className={`w-20 h-20 rounded-full ${statusConfig.color} flex items-center justify-center`}>
          <StatusIcon className={`h-10 w-10 text-white ${statusConfig.iconClass}`} />
        </div>
        
        <div className="text-center">
          <h3 className="text-lg font-semibold">{contactName || contactPhone}</h3>
          <p className="text-sm text-muted-foreground">{contactPhone}</p>
        </div>

        <Badge variant="outline" className="text-sm">
          {statusConfig.label}
        </Badge>

        {/* Timer */}
        {callData?.status === 'connected' && (
          <div className="flex items-center gap-2 text-2xl font-mono">
            <Clock className="h-5 w-5 text-muted-foreground" />
            {formatTime(elapsedTime)}
          </div>
        )}

        {/* Final duration */}
        {isCallEnded && callData?.duration_seconds && callData.duration_seconds > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Duração: {formatTime(callData.duration_seconds)}
          </div>
        )}
      </div>

      {/* Error Message */}
      {callData?.error_message && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3">
          <p className="text-sm text-red-600">{callData.error_message}</p>
        </div>
      )}

      {/* Transcript */}
      {callData?.transcript && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Transcrição</h4>
          <ScrollArea className="h-40 rounded-lg border bg-muted/30 p-3">
            <pre className="text-xs whitespace-pre-wrap font-sans">
              {callData.transcript}
            </pre>
          </ScrollArea>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {!isCallEnded ? (
          <Button
            variant="destructive"
            className="flex-1"
            onClick={onEnd}
          >
            <PhoneOff className="h-4 w-4 mr-2" />
            Encerrar
          </Button>
        ) : (
          <Button
            variant="outline"
            className="flex-1"
            onClick={onEnd}
          >
            Fechar
          </Button>
        )}
      </div>

      {/* Info */}
      {!isCallEnded && (
        <p className="text-xs text-center text-muted-foreground">
          A IA está conduzindo a chamada. O status será atualizado automaticamente.
        </p>
      )}
    </div>
  );
};
