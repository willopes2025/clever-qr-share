import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, CheckCheck, Clock, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { InboxMessage } from "@/hooks/useConversations";
import { motion } from "framer-motion";
import { MediaMessage } from "./MediaMessage";

const formatMessageTime = (message: InboxMessage) => {
  const date = new Date(message.created_at);

  if (isToday(date)) {
    return format(date, "HH:mm");
  }
  if (isYesterday(date)) {
    return `Ontem, ${format(date, "HH:mm")}`;
  }
  return format(date, "dd/MM, HH:mm", { locale: ptBR });
};

interface MessageBubbleProps {
  message: InboxMessage;
  isOptimistic?: boolean;
}

export const MessageBubble = ({ message, isOptimistic }: MessageBubbleProps) => {
  const isOutbound = message.direction === "outbound";
  const hasMedia = message.media_url && message.message_type !== 'text';
  const hasText = message.content && message.content.trim() !== '';

  const getStatusIcon = () => {
    if (!isOutbound) return null;
    
    if (isOptimistic) {
      return <Loader2 className="h-3 w-3 text-primary-foreground/70 animate-spin" />;
    }
    
    // Erro - mensagem falhou
    if (message.status === 'failed' || message.status === 'error') {
      return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
    }
    
    // Lida - double check azul
    if (message.read_at) {
      return <CheckCheck className="h-3.5 w-3.5 text-blue-400" />;
    }
    
    // Entregue - double check cinza
    if (message.delivered_at) {
      return <CheckCheck className="h-3.5 w-3.5 text-primary-foreground/70" />;
    }
    
    // Enviada - single check
    if (message.sent_at) {
      return <Check className="h-3.5 w-3.5 text-primary-foreground/70" />;
    }
    
    // Aguardando - relógio
    return <Clock className="h-3 w-3 text-primary-foreground/70" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: isOptimistic ? 0.7 : 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "flex",
        isOutbound ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm transition-all duration-200",
          isOutbound
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-card border border-border rounded-bl-md",
          isOptimistic && "opacity-70"
        )}
      >
        {/* Media content */}
        {hasMedia && (
          <div className={cn("mb-2", !hasText && "mb-0")}>
            <MediaMessage 
              mediaUrl={message.media_url!} 
              messageType={message.message_type}
              messageId={message.id}
              transcription={message.transcription}
            />
          </div>
        )}

        {/* Text content */}
        {hasText && (
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
        )}

        {/* Timestamp and status */}
        <div
          className={cn(
            "flex items-center gap-1 mt-1",
            isOutbound ? "justify-end" : "justify-start"
          )}
        >
          <span
            className={cn(
              "text-[10px]",
              isOutbound
                ? "text-primary-foreground/70"
                : "text-muted-foreground"
            )}
          >
            {formatMessageTime(message)}
          </span>
          {getStatusIcon()}
        </div>
      </div>
    </motion.div>
  );
};
