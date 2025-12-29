import { useState, useEffect, useMemo } from "react";
import { Bot, PhoneOff, Mic, MicOff, Volume2, VolumeX, Loader2, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useElevenLabsConversation } from "@/hooks/useElevenLabsConversation";
import { motion, AnimatePresence } from "framer-motion";
import { AIAgentConfig } from "@/hooks/useAIAgentConfig";

interface AICallInterfaceProps {
  agentId: string;
  agentConfig?: AIAgentConfig | null;
  contactName?: string;
  contactPhone?: string;
  conversationContext?: string;
  onTranscriptUpdate?: (transcript: string) => void;
  onEnd?: () => void;
}

export const AICallInterface = ({
  agentId,
  agentConfig,
  contactName,
  contactPhone,
  conversationContext,
  onTranscriptUpdate,
  onEnd,
}: AICallInterfaceProps) => {
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);

  // Build dynamic conversation context from agent config
  const dynamicContext = useMemo(() => {
    if (!agentConfig) return conversationContext;

    const parts: string[] = [];

    if (agentConfig.personality_prompt) {
      parts.push(`[Personalidade do Agente]\n${agentConfig.personality_prompt}`);
    }

    if (agentConfig.behavior_rules) {
      parts.push(`[Regras de Comportamento]\n${agentConfig.behavior_rules}`);
    }

    if (agentConfig.greeting_message) {
      parts.push(`[Mensagem de Saudação Sugerida]\n${agentConfig.greeting_message}`);
    }

    if (agentConfig.handoff_keywords?.length) {
      parts.push(`[Palavras-Chave para Transferência]\nQuando o cliente mencionar: ${agentConfig.handoff_keywords.join(", ")}, ofereça transferência para atendente humano.`);
    }

    if (agentConfig.fallback_message) {
      parts.push(`[Em caso de dúvida]\n${agentConfig.fallback_message}`);
    }

    if (conversationContext) {
      parts.push(`[Contexto Adicional da Conversa]\n${conversationContext}`);
    }

    return parts.join("\n\n");
  }, [agentConfig, conversationContext]);

  const {
    isConnecting,
    isConnected,
    isSpeaking,
    messages,
    transcript,
    error,
    startConversation,
    endConversation,
    setVolume: setAudioVolume,
  } = useElevenLabsConversation({
    agentId,
    contactName,
    contactPhone,
    conversationContext: dynamicContext,
    onTranscriptUpdate,
    onStatusChange: (status) => {
      if (status === "connected") {
        setStartTime(new Date());
      } else if (status === "disconnected") {
        setStartTime(null);
      }
    },
  });

  // Auto-start conversation on mount
  useEffect(() => {
    startConversation();
    return () => {
      endConversation();
    };
  }, []);

  // Duration timer
  useEffect(() => {
    if (!startTime) {
      setDuration(0);
      return;
    }

    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  // Update transcript when messages change
  useEffect(() => {
    if (transcript) {
      onTranscriptUpdate?.(transcript);
    }
  }, [transcript, onTranscriptUpdate]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = async () => {
    await endConversation();
    onEnd?.();
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleVolume = () => {
    const newVolume = volume === 0 ? 1 : 0;
    setVolume(newVolume);
    setAudioVolume({ volume: newVolume });
  };

  if (isConnecting) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center"
        >
          <Bot className="h-8 w-8 text-primary-foreground" />
        </motion.div>
        <div className="text-center space-y-1">
          <p className="text-lg font-medium">Conectando com IA...</p>
          {agentConfig && (
            <p className="text-sm text-primary">{agentConfig.agent_name}</p>
          )}
          <p className="text-sm text-muted-foreground">Preparando agente de voz</p>
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <Bot className="h-8 w-8 text-destructive" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-lg font-medium text-destructive">Erro na conexão</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
        <Button variant="outline" onClick={startConversation}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* AI Avatar with Speaking Animation */}
      <div className="flex flex-col items-center space-y-4">
        <motion.div
          animate={isSpeaking ? { scale: [1, 1.05, 1] } : {}}
          transition={{ repeat: Infinity, duration: 0.5 }}
          className={cn(
            "relative w-24 h-24 rounded-full flex items-center justify-center",
            "bg-gradient-to-br from-primary/80 to-primary text-primary-foreground"
          )}
        >
          <Bot className="h-12 w-12" />
          
          {/* Speaking waves */}
          <AnimatePresence>
            {isSpeaking && (
              <>
                <motion.div
                  initial={{ scale: 1, opacity: 0.8 }}
                  animate={{ scale: 1.5, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="absolute inset-0 rounded-full border-2 border-primary"
                />
                <motion.div
                  initial={{ scale: 1, opacity: 0.6 }}
                  animate={{ scale: 1.8, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0.3 }}
                  className="absolute inset-0 rounded-full border-2 border-primary"
                />
              </>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Agent & Contact Info */}
        <div className="text-center">
          {agentConfig && (
            <Badge variant="secondary" className="mb-2">
              {agentConfig.agent_name}
            </Badge>
          )}
          <h3 className="text-lg font-semibold">{contactName || "Cliente"}</h3>
          {contactPhone && (
            <p className="text-sm text-muted-foreground">{contactPhone}</p>
          )}
        </div>

        {/* Status Badges */}
        <div className="flex items-center gap-2">
          <Badge 
            variant="outline" 
            className={cn(
              "gap-1",
              isConnected ? "text-emerald-500 border-emerald-500/30" : "text-muted-foreground"
            )}
          >
            {isConnected ? "Conectado" : "Desconectado"}
          </Badge>
          
          {isSpeaking && (
            <Badge variant="outline" className="gap-1 text-primary border-primary/30">
              <Waves className="h-3 w-3" />
              Falando
            </Badge>
          )}
        </div>

        {/* Duration */}
        {isConnected && (
          <div className="text-3xl font-mono font-bold text-primary">
            {formatDuration(duration)}
          </div>
        )}
      </div>

      {/* Transcript */}
      {messages.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Transcrição em tempo real
          </h4>
          <ScrollArea className="h-40 rounded-lg border bg-muted/30 p-3">
            <div className="space-y-2">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={cn(
                    "text-sm p-2 rounded-lg",
                    msg.role === "user"
                      ? "bg-primary/10 ml-4"
                      : "bg-secondary mr-4"
                  )}
                >
                  <span className="font-medium text-xs text-muted-foreground block mb-1">
                    {msg.role === "user" ? "Cliente" : agentConfig?.agent_name || "IA"}
                  </span>
                  {msg.content}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="icon"
          className="h-14 w-14 rounded-full"
          onClick={toggleMute}
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
        >
          <PhoneOff className="h-7 w-7" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          className="h-14 w-14 rounded-full"
          onClick={toggleVolume}
        >
          {volume === 0 ? (
            <VolumeX className="h-6 w-6 text-destructive" />
          ) : (
            <Volume2 className="h-6 w-6" />
          )}
        </Button>
      </div>
    </div>
  );
};
