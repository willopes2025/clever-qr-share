import { useEffect, useRef, useState, useCallback } from "react";
import { Send, Phone, MoreVertical, Smartphone, Loader2 } from "lucide-react";
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
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { EmojiPicker } from "./EmojiPicker";
import { ScrollToBottomButton } from "./ScrollToBottomButton";
import { VoiceRecorder } from "./VoiceRecorder";
import { MediaUploadButton } from "./MediaUploadButton";
import { AIAssistantButton } from "./AIAssistantButton";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface MessageViewProps {
  conversation: Conversation;
}

interface OptimisticMessage extends InboxMessage {
  isOptimistic: true;
}

export const MessageView = ({ conversation }: MessageViewProps) => {
  const { messages, isLoading, sendMessage, sendMediaMessage, refetch } = useMessages(conversation.id);
  const { instances } = useWhatsAppInstances();
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>(
    conversation.instance_id || ""
  );
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isScrolledToBottom = useRef(true);

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

  // Clear optimistic messages when real messages arrive
  useEffect(() => {
    if (messages?.length) {
      setOptimisticMessages(prev => 
        prev.filter(opt => 
          !messages.some(m => m.content === opt.content && m.direction === 'outbound')
        )
      );
    }
  }, [messages]);

  // Scroll handling
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (scrollEndRef.current) {
      scrollEndRef.current.scrollIntoView({ behavior });
      setNewMessagesCount(0);
      isScrolledToBottom.current = true;
    }
  }, []);

  // Check scroll position
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100;
    isScrolledToBottom.current = isAtBottom;
    setShowScrollButton(!isAtBottom);
    
    if (isAtBottom) {
      setNewMessagesCount(0);
    }
  }, []);

  // Scroll to bottom when messages change (if already at bottom)
  useEffect(() => {
    if (isScrolledToBottom.current) {
      scrollToBottom("smooth");
    } else if (messages?.length) {
      setNewMessagesCount(prev => prev + 1);
    }
  }, [messages, scrollToBottom]);

  // Initial scroll on conversation change
  useEffect(() => {
    scrollToBottom("instant");
    setNewMessagesCount(0);
    setOptimisticMessages([]);
  }, [conversation.id, scrollToBottom]);

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

  // Simulate typing indicator for demo
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    if (isSending) {
      timeout = setTimeout(() => {
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 3000);
      }, 1500);
    }
    
    return () => clearTimeout(timeout);
  }, [isSending]);

  const handleSend = async () => {
    if (!newMessage.trim() || isSending || !selectedInstanceId) return;

    const messageContent = newMessage.trim();
    
    // Add optimistic message
    const optimisticMessage: OptimisticMessage = {
      id: `optimistic-${Date.now()}`,
      conversation_id: conversation.id,
      content: messageContent,
      direction: 'outbound',
      status: 'sending',
      message_type: 'text',
      created_at: new Date().toISOString(),
      sent_at: null,
      delivered_at: null,
      read_at: null,
      media_url: null,
      whatsapp_message_id: null,
      user_id: '',
      isOptimistic: true,
    };
    
    setOptimisticMessages(prev => [...prev, optimisticMessage]);
    setNewMessage("");
    setIsSending(true);
    
    setTimeout(() => scrollToBottom("smooth"), 50);

    try {
      await sendMessage.mutateAsync({
        content: messageContent,
        conversationId: conversation.id,
        instanceId: selectedInstanceId,
      });
      toast.success("Mensagem enviada!", { duration: 2000 });
    } catch (error) {
      toast.error("Erro ao enviar mensagem");
      setOptimisticMessages(prev => 
        prev.filter(m => m.id !== optimisticMessage.id)
      );
      setNewMessage(messageContent);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendMedia = async (mediaUrl: string, mediaType: 'image' | 'document' | 'audio') => {
    if (!selectedInstanceId) {
      toast.error("Selecione uma instância primeiro");
      return;
    }

    // Add optimistic message
    const optimisticMessage: OptimisticMessage = {
      id: `optimistic-${Date.now()}`,
      conversation_id: conversation.id,
      content: mediaType === 'image' ? '[Imagem]' : mediaType === 'audio' ? '[Áudio]' : '[Documento]',
      direction: 'outbound',
      status: 'sending',
      message_type: mediaType,
      media_url: mediaUrl,
      created_at: new Date().toISOString(),
      sent_at: null,
      delivered_at: null,
      read_at: null,
      whatsapp_message_id: null,
      user_id: '',
      isOptimistic: true,
    };
    
    setOptimisticMessages(prev => [...prev, optimisticMessage]);
    setIsRecordingAudio(false);
    
    setTimeout(() => scrollToBottom("smooth"), 50);

    try {
      await sendMediaMessage.mutateAsync({
        conversationId: conversation.id,
        instanceId: selectedInstanceId,
        mediaUrl,
        mediaType,
      });
      toast.success("Mídia enviada!", { duration: 2000 });
    } catch (error) {
      toast.error("Erro ao enviar mídia");
      setOptimisticMessages(prev => 
        prev.filter(m => m.id !== optimisticMessage.id)
      );
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    inputRef.current?.focus();
  };

  const handleAISuggestion = (text: string) => {
    setNewMessage(text);
    inputRef.current?.focus();
  };

  const selectedInstance = connectedInstances.find(i => i.id === selectedInstanceId);
  const allMessages = [...(messages || []), ...optimisticMessages];

  return (
    <div className="flex-1 flex flex-col h-full bg-background relative">
      {/* Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <motion.div 
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground font-medium"
          >
            {(conversation.contact?.name || conversation.contact?.phone || "?")[0].toUpperCase()}
          </motion.div>
          <div>
            <h3 className="font-semibold text-foreground">
              {conversation.contact?.name || conversation.contact?.phone || "Contato Desconhecido"}
            </h3>
            <AnimatePresence mode="wait">
              {isTyping ? (
                <motion.p
                  key="typing"
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="text-xs text-primary font-medium"
                >
                  digitando...
                </motion.p>
              ) : (
                <motion.p
                  key="phone"
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="text-xs text-muted-foreground"
                >
                  {conversation.contact?.phone}
                </motion.p>
              )}
            </AnimatePresence>
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
      <ScrollArea 
        className="flex-1 p-4" 
        onScrollCapture={handleScroll}
        ref={scrollAreaRef}
      >
        <div className="space-y-3 max-w-3xl mx-auto">
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
          ) : allMessages.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12"
            >
              <p className="text-muted-foreground">
                Nenhuma mensagem ainda. Inicie uma conversa!
              </p>
            </motion.div>
          ) : (
            <>
              {allMessages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOptimistic={'isOptimistic' in message}
                />
              ))}
              
              {/* Typing Indicator */}
              <AnimatePresence>
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <TypingIndicator />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
          <div ref={scrollEndRef} />
        </div>
      </ScrollArea>

      {/* Scroll to bottom button */}
      <ScrollToBottomButton
        show={showScrollButton}
        onClick={() => scrollToBottom("smooth")}
        newMessagesCount={newMessagesCount}
      />

      {/* Input */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex gap-2 max-w-3xl mx-auto items-center">
          <MediaUploadButton 
            onUpload={(url, type) => handleSendMedia(url, type)} 
            disabled={isSending || !selectedInstanceId}
          />
          
          <EmojiPicker onEmojiSelect={handleEmojiSelect} />
          
          <Input
            ref={inputRef}
            placeholder="Digite sua mensagem..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 bg-muted/50"
            disabled={isSending}
          />

          <AIAssistantButton
            conversationId={conversation.id}
            onSuggestion={handleAISuggestion}
            disabled={isSending}
          />

          <VoiceRecorder
            onSend={(audioUrl) => handleSendMedia(audioUrl, 'audio')}
            disabled={isSending || !selectedInstanceId}
          />
          
          <Button 
            onClick={handleSend} 
            disabled={!newMessage.trim() || isSending || !selectedInstanceId}
            className="shrink-0 min-w-[44px]"
          >
            {isSending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        
        {!selectedInstanceId && connectedInstances.length > 0 && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-amber-500 mt-2 text-center"
          >
            Selecione uma instância para enviar mensagens
          </motion.p>
        )}
      </div>
    </div>
  );
};
