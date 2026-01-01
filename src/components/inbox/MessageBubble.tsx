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
      return <Loader2 className="h-3 w-3 animate-spin text-[#667781]" />;
    }
    if (message.status === "failed") {
      return <AlertCircle className="h-3 w-3 text-red-500" />;
    }
    if (message.read_at) {
      return <CheckCheck className="h-3 w-3 text-[#53bdeb]" />;
    }
    if (message.delivered_at) {
      return <CheckCheck className="h-3 w-3 text-[#667781]" />;
    }
    if (message.sent_at) {
      return <Check className="h-3 w-3 text-[#667781]" />;
    }
    return <Clock className="h-3 w-3 text-[#667781]" />;
  };

  const senderName = (message as any).sent_by_user?.full_name;

  return (
    <div
      className={cn(
        "flex flex-col max-w-[85%] md:max-w-[65%]",
        isOutbound ? "ml-auto items-end" : "mr-auto items-start"
      )}
    >
      {isOutbound && senderName && (
        <span className="text-[11px] text-[#667781] mb-0.5 px-1">
          {senderName}
        </span>
      )}
      
      {/* Message bubble with tail */}
      <div className="relative">
        {/* Tail */}
        <div
          className={cn(
            "absolute top-0 w-3 h-3",
            isOutbound 
              ? "right-[-6px] bubble-tail-outbound" 
              : "left-[-6px] bubble-tail-inbound"
          )}
        />
        
        {/* Bubble */}
        <div
          className={cn(
            "relative rounded-lg px-3 py-1.5 shadow-sm",
            isOutbound
              ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef]"
              : "bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef]",
            isOptimistic && "opacity-70"
          )}
        >
          {message.media_url && (
            <div className="mb-1">
              <MediaMessage
                mediaUrl={message.media_url}
                messageType={message.message_type}
                messageId={message.id}
                transcription={message.transcription}
              />
            </div>
          )}
          
          {message.content && (
            <p className="text-[14.2px] leading-[19px] whitespace-pre-wrap break-words">
              {message.content}
            </p>
          )}
          
          {/* Timestamp and status */}
          <div className={cn(
            "flex items-center gap-1 justify-end mt-0.5 -mb-0.5",
            !message.content && message.media_url && "absolute bottom-1 right-2 bg-black/30 rounded px-1"
          )}>
            <span className={cn(
              "text-[11px] leading-none",
              !message.content && message.media_url 
                ? "text-white" 
                : "text-[#667781] dark:text-[#8696a0]"
            )}>
              {formatMessageTime(message)}
            </span>
            {isOutbound && (
              <span className="ml-0.5">
                {getStatusIcon()}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
