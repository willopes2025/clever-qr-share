import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Send, Phone, MoreVertical, Check, CheckCheck, Smartphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Conversation, InboxMessage, useMessages } from "@/hooks/useConversations";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { supabase } from "@/integrations/supabase/client";

interface MessageViewProps {
  conversation: Conversation;
}

export const MessageView = ({ conversation }: MessageViewProps) => {
  const { messages, isLoading, sendMessage, refetch } = useMessages(conversation.id);
  const { instances } = useWhatsAppInstances();
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>(
    conversation.instance_id || ""
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get connected instances only
  const connectedInstances = instances?.filter(i => i.status === 'connected') || [];

  // Set default instance when instances load or conversation changes
  useEffect(() => {
    if (conversation.instance_id) {
      setSelectedInstanceId(conversation.instance_id);
    } else if (connectedInstances.length > 0 && !selectedInstanceId) {
      setSelectedInstanceId(connectedInstances[0].id);
    }
  }, [conversation.instance_id, connectedInstances, selectedInstanceId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`messages-${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'inbox_messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation.id, refetch]);

  const handleSend = async () => {
    if (!newMessage.trim() || isSending || !selectedInstanceId) return;

    setIsSending(true);
    try {
      await sendMessage.mutateAsync({
        content: newMessage.trim(),
        conversationId: conversation.id,
        instanceId: selectedInstanceId,
      });
      setNewMessage("");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getStatusIcon = (message: InboxMessage) => {
    if (message.direction === 'inbound') return null;
    
    if (message.read_at) {
      return <CheckCheck className="h-4 w-4 text-blue-400" />;
    }
    if (message.delivered_at) {
      return <CheckCheck className="h-4 w-4 text-muted-foreground" />;
    }
    return <Check className="h-4 w-4 text-muted-foreground" />;
  };

  const selectedInstance = connectedInstances.find(i => i.id === selectedInstanceId);

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground font-medium">
            {(conversation.contact?.name || conversation.contact?.phone || "?")[0].toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">
              {conversation.contact?.name || conversation.contact?.phone || "Contato Desconhecido"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {conversation.contact?.phone}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Instance Selector */}
          <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
            <SelectTrigger className="w-[180px] h-9">
              <Smartphone className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Selecionar número" />
            </SelectTrigger>
            <SelectContent>
              {connectedInstances.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground text-center">
                  Nenhuma instância conectada
                </div>
              ) : (
                connectedInstances.map((instance) => (
                  <SelectItem key={instance.id} value={instance.id}>
                    {instance.instance_name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <Phone className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-3xl mx-auto">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "animate-pulse h-16 rounded-2xl bg-muted",
                    i % 2 === 0 ? "w-2/3" : "w-2/3 ml-auto"
                  )}
                />
              ))}
            </div>
          ) : messages?.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                Nenhuma mensagem ainda. Inicie uma conversa!
              </p>
            </div>
          ) : (
            messages?.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  message.direction === "outbound" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm",
                    message.direction === "outbound"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-card border border-border rounded-bl-md"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                  <div
                    className={cn(
                      "flex items-center gap-1 mt-1",
                      message.direction === "outbound" ? "justify-end" : "justify-start"
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs",
                        message.direction === "outbound"
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      )}
                    >
                      {message.sent_at && format(new Date(message.sent_at), "HH:mm")}
                    </span>
                    {getStatusIcon(message)}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex gap-3 max-w-3xl mx-auto">
          <Input
            placeholder="Digite sua mensagem..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 bg-muted/50"
            disabled={isSending}
          />
          <Button 
            onClick={handleSend} 
            disabled={!newMessage.trim() || isSending}
            className="shrink-0"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
