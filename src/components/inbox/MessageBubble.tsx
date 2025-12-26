import { motion } from "framer-motion";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, CheckCheck, Clock, AlertCircle, Loader2 } from "lucide-react";
import { InboxMessage } from "@/hooks/useConversations";
import { MediaMessage } from "./MediaMessage";
import { cn } from "@/lib/utils";

const formatMessageTime = (message: InboxMessage) => {
  const date = new Date(message.created_at);
  if (isToday(date)) {
    return format(date, "HH:mm", { locale: ptBR });
  } else if (isYesterday(date)) {
    return `Ontem ${format(date, "HH:mm", { locale: ptBR })}`;
  }
  return format(date, "dd/MM HH:mm", { locale: ptBR });
};

interface MessageBubbleProps {
  message: InboxMessage;
  isOptimistic?: boolean;
}

export const MessageBubble = ({ message, isOptimistic }: MessageBubbleProps) => {
  const isOutbound = message.direction === "outbound";
  
  const getStatusIcon = () => {
    if (isOptimistic || message.status === "sending") {
      return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
    }
    if (message.status === "failed") {
      return <AlertCircle className="h-3 w-3 text-destructive" />;
    }
    if (message.read_at) {
      return <CheckCheck className="h-3 w-3 text-primary" />;
    }
    if (message.delivered_at) {
      return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
    }
    if (message.sent_at) {
      return <Check className="h-3 w-3 text-muted-foreground" />;
    }
    return <Clock className="h-3 w-3 text-muted-foreground" />;
  };

  const senderName = (message as any).sent_by_user?.full_name;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex flex-col max-w-[85%] md:max-w-[70%]",
        isOutbound ? "ml-auto items-end" : "mr-auto items-start"
      )}
    >
      {isOutbound && senderName && (
        <span className="text-[10px] text-muted-foreground mb-0.5 px-2">
          {senderName}
        </span>
      )}
      
      <div
        className={cn(
          "rounded-2xl px-4 py-2 shadow-soft",
          isOutbound
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-secondary text-secondary-foreground rounded-bl-md",
          isOptimistic && "opacity-70"
        )}
      >
        {message.media_url && (
          <MediaMessage
            mediaUrl={message.media_url}
            messageType={message.message_type}
            messageId={message.id}
            transcription={message.transcription}
          />
        )}
        
        {message.content && (
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
        )}
        
        <div className={cn(
          "flex items-center gap-1 mt-1",
          isOutbound ? "justify-end" : "justify-start"
        )}>
          <span className={cn(
            "text-[10px]",
            isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"
          )}>
            {formatMessageTime(message)}
          </span>
          {isOutbound && getStatusIcon()}
        </div>
      </div>
    </motion.div>
  );
};
