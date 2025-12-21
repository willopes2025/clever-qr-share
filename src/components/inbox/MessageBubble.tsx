import { format } from "date-fns";
import { Check, CheckCheck, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { InboxMessage } from "@/hooks/useConversations";
import { motion } from "framer-motion";

interface MessageBubbleProps {
  message: InboxMessage;
  isOptimistic?: boolean;
}

export const MessageBubble = ({ message, isOptimistic }: MessageBubbleProps) => {
  const isOutbound = message.direction === "outbound";

  const getStatusIcon = () => {
    if (!isOutbound) return null;
    
    if (isOptimistic) {
      return <Loader2 className="h-3 w-3 text-primary-foreground/70 animate-spin" />;
    }
    
    if (message.read_at) {
      return <CheckCheck className="h-3.5 w-3.5 text-blue-400" />;
    }
    if (message.delivered_at) {
      return <CheckCheck className="h-3.5 w-3.5 text-primary-foreground/70" />;
    }
    if (message.sent_at) {
      return <Check className="h-3.5 w-3.5 text-primary-foreground/70" />;
    }
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
        <p className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </p>
        <div
          className={cn(
            "flex items-center gap-1 mt-1",
            isOutbound ? "justify-end" : "justify-start"
          )}
        >
          <span
            className={cn(
              "text-[11px]",
              isOutbound
                ? "text-primary-foreground/70"
                : "text-muted-foreground"
            )}
          >
            {message.sent_at 
              ? format(new Date(message.sent_at), "HH:mm")
              : format(new Date(), "HH:mm")}
          </span>
          {getStatusIcon()}
        </div>
      </div>
    </motion.div>
  );
};
