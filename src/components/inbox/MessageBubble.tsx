import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, CheckCheck, Clock, AlertCircle, Loader2, Bot, Smartphone, User, Copy } from "lucide-react";
import { InboxMessage } from "@/hooks/useConversations";
import { MediaMessage } from "./MediaMessage";
import { LocationMessage } from "./LocationMessage";
import { MessageReactionsDisplay, ReactionPicker } from "./MessageReactions";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatBubbleTimeBR, formatFullDateTimeBR } from "@/lib/date-utils";

const formatMessageTime = (message: InboxMessage) => {
  return formatBubbleTimeBR(message.created_at);
};

interface MessageBubbleProps {
  message: InboxMessage;
  isOptimistic?: boolean;
  instancePhoneNumber?: string | null;
  onReact?: (messageId: string, emoji: string) => void;
}

export const MessageBubble = ({ message, isOptimistic, instancePhoneNumber, onReact }: MessageBubbleProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const isOutbound = message.direction === "outbound";
  const isFailed = message.status === "failed";
  
  const getStatusIcon = () => {
    if (isOptimistic || message.status === "sending") {
      return <Loader2 className="h-3 w-3 animate-spin text-[#667781]" />;
    }
    if (isFailed) {
      return (
        <Popover>
          <PopoverTrigger asChild>
            <button className="inline-flex items-center hover:scale-125 transition-transform cursor-pointer" title="Ver detalhes do erro">
              <AlertCircle className="h-3.5 w-3.5 text-red-500" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" className="w-72 p-0">
            <div className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                <span className="text-sm font-medium text-red-600 dark:text-red-400">Falha no envio</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {message.error_message || 'Não foi possível enviar esta mensagem. O servidor retornou um erro desconhecido.'}
              </p>
              <p className="text-[10px] text-muted-foreground/70">
                {formatFullDateTimeBR(message.created_at)}
              </p>
            </div>
          </PopoverContent>
        </Popover>
      );
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

  const senderName = message.sent_by_user?.full_name;
  const isAIMessage = message.is_ai_generated || !!message.sent_by_ai_agent_id;
  const aiAgentName = message.ai_agent?.agent_name;
  
  // Detectar se foi enviado externamente (fora do sistema - pelo WhatsApp celular/web)
  const isExternalSend = isOutbound && 
    !message.sent_by_user_id && 
    !message.sent_by_ai_agent_id && 
    !message.is_ai_generated;

  return (
    <div
      className={cn(
        "flex flex-col max-w-[85%] md:max-w-[65%]",
        isOutbound ? "ml-auto items-end" : "mr-auto items-start"
      )}
    >
      {isOutbound && (senderName || isAIMessage || isExternalSend) && (
        <div className="flex items-center gap-1.5 mb-0.5 px-1">
          {isAIMessage ? (
            <>
              <Bot className="h-3 w-3 text-primary" />
              <span className="text-[11px] text-primary font-medium">
                {aiAgentName || 'Agente IA'}
              </span>
              <Badge variant="outline" className="h-4 px-1 text-[9px] border-primary/30 text-primary">
                IA
              </Badge>
            </>
          ) : isExternalSend ? (
            <>
              <Smartphone className="h-3 w-3 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground italic">
                Enviado pelo WhatsApp
              </span>
              {instancePhoneNumber && (
                <span className="text-[11px] text-muted-foreground">
                  • {instancePhoneNumber}
                </span>
              )}
            </>
          ) : (
            <>
              <span className="text-[11px] text-[#667781]">
                {senderName}
              </span>
              {instancePhoneNumber && (
                <span className="text-[11px] text-muted-foreground">
                  • {instancePhoneNumber}
                </span>
              )}
            </>
          )}
        </div>
      )}
      
      {/* Message bubble with tail and reaction picker */}
      <div 
        className="relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Reaction picker on hover */}
        {isHovered && onReact && !isOptimistic && (
          <ReactionPicker
            isOutbound={isOutbound}
            onReact={(emoji) => onReact(message.id, emoji)}
          />
        )}

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
            isOptimistic && "opacity-70",
            isFailed && "border border-red-500/30"
          )}
        >
          {message.media_url && (
            <div className="mb-1">
              <MediaMessage
                mediaUrl={message.media_url}
                messageType={message.message_type}
                messageId={message.id}
                transcription={message.transcription}
                extractedContent={message.extracted_content}
              />
            </div>
          )}
          
          {/* vCard contact message */}
          {message.message_type === 'contact' && message.content && (() => {
            try {
              const parsed = JSON.parse(message.content);
              if (parsed?.type === 'vcard' && parsed?.contacts) {
                return (
                  <div className="space-y-2">
                    {parsed.contacts.map((c: { name: string; phone: string }, i: number) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 bg-background/50 rounded-lg min-w-[200px]">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.name}</p>
                          {c.phone && (
                            <p className="text-xs text-muted-foreground font-mono">{c.phone}</p>
                          )}
                        </div>
                        {c.phone && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(c.phone);
                              import('sonner').then(m => m.toast.success('Número copiado!'));
                            }}
                            className="h-8 w-8 flex items-center justify-center rounded hover:bg-background/80 shrink-0"
                            title="Copiar número"
                          >
                            <Copy className="h-4 w-4 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                );
              }
            } catch {}
            return null;
          })()}
          
          {/* Location message */}
          {message.message_type === 'location' && message.content && (
            <div className="mb-1">
              <LocationMessage content={message.content} />
            </div>
          )}
          
          {message.content && message.message_type !== 'contact' && message.message_type !== 'location' && (
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

      {/* Reactions display */}
      <MessageReactionsDisplay 
        reactions={message.reactions || []} 
        isOutbound={isOutbound} 
      />
    </div>
  );
};
