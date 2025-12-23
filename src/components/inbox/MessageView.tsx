import { useEffect, useRef, useState, useCallback, Fragment } from "react";
import { Send, Smartphone, Edit2, Check, X, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { DateSeparator } from "./DateSeparator";
import { TypingIndicator } from "./TypingIndicator";
import { EmojiPicker } from "./EmojiPicker";
import { ScrollToBottomButton } from "./ScrollToBottomButton";
import { VoiceRecorder } from "./VoiceRecorder";
import { MediaUploadButton } from "./MediaUploadButton";
import { AIAssistantButton } from "./AIAssistantButton";
import { ContactInfoPanel } from "./ContactInfoPanel";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { isToday, isSameDay } from "date-fns";

interface MessageViewProps {
  conversation: Conversation;
}

interface OptimisticMessage extends InboxMessage {
  isOptimistic: true;
}

export const MessageView = ({ conversation }: MessageViewProps) => {
  const { messages, isLoading, sendMessage, sendMediaMessage, refetch } = useMessages(conversation.id);
  const { instances } = useWhatsAppInstances();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState("");
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>(
    conversation.instance_id || ""
  );
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [showContactInfo, setShowContactInfo] = useState(false);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
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

  // Typing indicator is now based on optimistic messages being sent
  useEffect(() => {
    const hasPendingMessages = optimisticMessages.length > 0;
    if (hasPendingMessages) {
      const timeout = setTimeout(() => setIsTyping(false), 3000);
      return () => clearTimeout(timeout);
    }
  }, [optimisticMessages.length]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedInstanceId) return;

    const messageContent = newMessage.trim();
    const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    
    // Add optimistic message
    const optimisticMessage: OptimisticMessage = {
      id: optimisticId,
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
    setNewMessage(""); // Clear immediately
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
    setTimeout(() => scrollToBottom("smooth"), 50);
    
    // Focus back to textarea immediately
    textareaRef.current?.focus();

    // Send in background - no await blocking
    sendMessage.mutateAsync({
      content: messageContent,
      conversationId: conversation.id,
      instanceId: selectedInstanceId,
    }).catch((error) => {
      toast.error("Erro ao enviar mensagem");
      setOptimisticMessages(prev => 
        prev.filter(m => m.id !== optimisticId)
      );
    });
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
      // Media sent successfully - no toast needed as user sees it in chat
    } catch (error) {
      toast.error("Erro ao enviar mídia");
      setOptimisticMessages(prev => 
        prev.filter(m => m.id !== optimisticMessage.id)
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    textareaRef.current?.focus();
  };

  const handleAISuggestion = (text: string) => {
    setNewMessage(text);
    textareaRef.current?.focus();
    // Trigger resize after setting text
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
      }
    }, 0);
  };

  const startEditingName = () => {
    setEditedName(conversation.contact?.name || "");
    setIsEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const handleSaveName = async () => {
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ name: editedName.trim() || null })
        .eq('id', conversation.contact_id);
      
      if (error) throw error;
      
      setIsEditingName(false);
      toast.success("Nome atualizado");
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    } catch (error) {
      toast.error("Erro ao atualizar nome");
    }
  };

  const shouldShowDateSeparator = (prevMessage: InboxMessage | OptimisticMessage | null, currentMessage: InboxMessage | OptimisticMessage) => {
    if (!prevMessage) return true;
    const prevDate = new Date(prevMessage.created_at);
    const currDate = new Date(currentMessage.created_at);
    return !isSameDay(prevDate, currDate);
  };

  const selectedInstance = connectedInstances.find(i => i.id === selectedInstanceId);
  const allMessages = [...(messages || []), ...optimisticMessages];

  return (
    <div className="flex-1 flex h-full">
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
            {isEditingName ? (
              <div className="flex items-center gap-1">
                <Input
                  ref={nameInputRef}
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="h-7 w-40 text-sm font-semibold"
                  placeholder="Nome do contato"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') setIsEditingName(false);
                  }}
                />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveName}>
                  <Check className="h-4 w-4 text-primary" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsEditingName(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <h3 className="font-semibold text-foreground">
                  {conversation.contact?.name || conversation.contact?.phone || "Contato Desconhecido"}
                </h3>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={startEditingName}>
                  <Edit2 className="h-3 w-3" />
                </Button>
              </div>
            )}
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
          <Select 
            value={selectedInstanceId} 
            onValueChange={async (value) => {
              setSelectedInstanceId(value);
              // Persist instance change to database
              try {
                await supabase
                  .from('conversations')
                  .update({ instance_id: value })
                  .eq('id', conversation.id);
                toast.success("Número de envio atualizado");
              } catch (error) {
                toast.error("Erro ao atualizar número");
              }
            }}
          >
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
          
          {/* Contact Info Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setShowContactInfo(!showContactInfo)}
          >
            <User className="h-4 w-4" />
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
              {allMessages.map((message, index) => {
                const prevMessage = index > 0 ? allMessages[index - 1] : null;
                const showDateSeparator = shouldShowDateSeparator(prevMessage, message);
                
                return (
                  <Fragment key={message.id}>
                    {showDateSeparator && (
                      <DateSeparator date={message.created_at} />
                    )}
                    <MessageBubble
                      message={message}
                      isOptimistic={'isOptimistic' in message}
                    />
                  </Fragment>
                );
              })}
              
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
        <div className="flex gap-2 max-w-3xl mx-auto items-end">
          <MediaUploadButton 
            onUpload={(url, type) => handleSendMedia(url, type)} 
            disabled={!selectedInstanceId}
          />
          
          <EmojiPicker onEmojiSelect={handleEmojiSelect} />
          
          <Textarea
            ref={textareaRef}
            placeholder="Digite sua mensagem..."
            value={newMessage}
            onChange={handleMessageChange}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-muted/50 min-h-[40px] max-h-[150px] resize-none py-2"
            rows={1}
          />

          <AIAssistantButton
            conversationId={conversation.id}
            onSuggestion={handleAISuggestion}
            currentMessage={newMessage}
          />

          <VoiceRecorder
            onSend={(audioUrl) => handleSendMedia(audioUrl, 'audio')}
            disabled={!selectedInstanceId}
          />
          
          <Button 
            onClick={handleSend} 
            disabled={!newMessage.trim() || !selectedInstanceId}
            className="shrink-0 min-w-[44px]"
          >
            <Send className="h-5 w-5" />
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
      
      {/* Contact Info Panel */}
      <ContactInfoPanel
        conversation={conversation}
        isOpen={showContactInfo}
        onClose={() => setShowContactInfo(false)}
      />
    </div>
  );
};
