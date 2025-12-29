import { useEffect, useRef, useState, useCallback, Fragment } from "react";
import { Send, Smartphone, Edit2, Check, X, User, Bot, Pause, Play, Loader2, Sparkles, ArrowRightLeft, MessageSquare, StickyNote, CheckSquare, Users, ArrowLeft, MoreVertical, SpellCheck } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Conversation, InboxMessage, useMessages } from "@/hooks/useConversations";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { useConversationNotes } from "@/hooks/useConversationNotes";
import { useConversationTasks } from "@/hooks/useConversationTasks";
import { useInternalMessages } from "@/hooks/useInternalMessages";
import { useMemberAutoCorrect } from "@/hooks/useMemberAutoCorrect";
import { supabase } from "@/integrations/supabase/client";
import { MessageBubble } from "./MessageBubble";
import { DateSeparator } from "./DateSeparator";
import { TypingIndicator } from "./TypingIndicator";
import { EmojiPicker } from "./EmojiPicker";
import { ScrollToBottomButton } from "./ScrollToBottomButton";
import { VoiceRecorder } from "./VoiceRecorder";
import { MediaUploadButton } from "./MediaUploadButton";
import { AIAssistantButton } from "./AIAssistantButton";
import { TransferConversationDialog } from "./TransferConversationDialog";
import { NotesTab } from "./NotesTab";
import { TasksTab } from "./TasksTab";
import { InternalChatTab } from "./InternalChatTab";
import { PhoneCallButton } from "./PhoneCallButton";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { isToday, isSameDay } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";

interface ConversationWithAI extends Conversation {
  campaign_id?: string | null;
  ai_handled?: boolean | null;
  ai_paused?: boolean | null;
  ai_handoff_requested?: boolean | null;
  ai_handoff_reason?: string | null;
  ai_interactions_count?: number | null;
}

interface MessageViewProps {
  conversation: ConversationWithAI;
  onBack?: () => void;
  onOpenRightPanel?: () => void;
}

interface OptimisticMessage extends InboxMessage {
  isOptimistic: true;
}

export const MessageView = ({ conversation, onBack, onOpenRightPanel }: MessageViewProps) => {
  const { messages, isLoading, sendMessage, sendMediaMessage, refetch } = useMessages(conversation.id);
  const { instances } = useWhatsAppInstances();
  const { notes } = useConversationNotes(conversation.id, conversation.contact_id);
  const { pendingTasks } = useConversationTasks(conversation.id, conversation.contact_id);
  const { messages: internalMessages } = useInternalMessages(conversation.id, conversation.contact_id);
  const { autoCorrectEnabled } = useMemberAutoCorrect();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
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
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [isInvokingAI, setIsInvokingAI] = useState(false);
  const [isAutoCorrect, setIsAutoCorrect] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  
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

    let messageContent = newMessage.trim();
    const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    
    // Se correção automática está ativada, corrigir antes de enviar
    if (autoCorrectEnabled && messageContent.length > 5) {
      setIsAutoCorrect(true);
      try {
        const { data, error } = await supabase.functions.invoke('inbox-ai-assistant', {
          body: { 
            conversationId: conversation.id, 
            action: 'rewrite', 
            tone: 'correction', 
            originalMessage: messageContent 
          }
        });
        
        if (!error && data?.success && data?.result) {
          messageContent = data.result;
        }
      } catch (error) {
        console.error('Auto-correct error:', error);
        // Continua com mensagem original se falhar
      } finally {
        setIsAutoCorrect(false);
      }
    }
    
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

  const handleInvokeAI = async () => {
    if (!selectedInstanceId) {
      toast.error("Selecione uma instância primeiro");
      return;
    }
    
    setIsInvokingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-campaign-agent', {
        body: { 
          conversationId: conversation.id,
          instanceId: selectedInstanceId,
          manualTrigger: true
        }
      });
      
      if (error) throw error;
      
      if (data?.success) {
        toast.success("IA acionada com sucesso");
      } else {
        toast.error(data?.reason || "Não foi possível acionar a IA");
      }
    } catch (error) {
      console.error("Error invoking AI:", error);
      toast.error("Erro ao acionar IA");
    } finally {
      setIsInvokingAI(false);
    }
  };

  const handleToggleAIPaused = async () => {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ 
          ai_paused: !conversation.ai_paused,
          ai_handoff_requested: false 
        })
        .eq('id', conversation.id);
      
      if (error) throw error;
      
      toast.success(conversation.ai_paused ? "IA retomada" : "IA pausada");
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (error) {
      toast.error("Erro ao alterar status da IA");
    }
  };

  return (
    <div className="flex-1 flex h-full w-full">
      <div className="flex-1 flex flex-col h-full bg-background relative">
      {/* Header */}
      <div className={cn(
        "px-3 md:px-4 flex items-center justify-between border-b border-border bg-card",
        isMobile ? "h-14" : "h-16"
      )}>
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          {/* Back button - Mobile only */}
          {isMobile && onBack && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={onBack}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          
          <motion.div 
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className={cn(
              "rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground font-medium shrink-0",
              isMobile ? "w-9 h-9 text-sm" : "w-10 h-10"
            )}
          >
            {(conversation.contact?.name || conversation.contact?.phone || "?")[0].toUpperCase()}
          </motion.div>
          <div className="min-w-0 flex-1">
            {isEditingName ? (
              <div className="flex items-center gap-1">
                <Input
                  ref={nameInputRef}
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="h-7 w-32 md:w-40 text-sm font-semibold"
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
              <div className="flex items-center gap-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate text-sm md:text-base">
                  {conversation.contact?.name || conversation.contact?.phone || "Contato Desconhecido"}
                </h3>
                {!isMobile && (
                  <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={startEditingName}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
            {!isMobile && (
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
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          {/* AI Status Badge - Desktop only */}
          {!isMobile && conversation.ai_handled && (
            <div className="flex items-center gap-2">
              {conversation.ai_handoff_requested ? (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 gap-1">
                  <User className="h-3 w-3" />
                  Aguardando Atendente
                </Badge>
              ) : conversation.ai_paused ? (
                <Badge variant="outline" className="bg-muted text-muted-foreground gap-1">
                  <Pause className="h-3 w-3" />
                  IA Pausada
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 gap-1">
                  <Bot className="h-3 w-3" />
                  IA Ativa
                </Badge>
              )}
            </div>
          )}

          {/* Desktop: Full buttons */}
          {!isMobile ? (
            <>
              {/* Phone Call Button */}
              {conversation.contact?.phone && (
                <PhoneCallButton
                  contactPhone={conversation.contact.phone}
                  contactId={conversation.contact_id}
                  conversationId={conversation.id}
                  contactName={conversation.contact.name || undefined}
                />
              )}

              {/* Invoke AI Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={handleInvokeAI}
                    disabled={isInvokingAI || !selectedInstanceId}
                  >
                    {isInvokingAI ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Acionar IA
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  A IA vai ler a conversa e continuar
                </TooltipContent>
              </Tooltip>

              {/* Toggle AI Button */}
              {conversation.ai_handled && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleToggleAIPaused}
                    >
                      {conversation.ai_paused ? (
                        <Play className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Pause className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {conversation.ai_paused ? "Retomar IA" : "Pausar IA"}
                  </TooltipContent>
                </Tooltip>
              )}
              
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
              
              {/* Transfer Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setShowTransferDialog(true)}
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Transferir conversa
                </TooltipContent>
              </Tooltip>
              
              {/* Contact Info Button */}
              {onOpenRightPanel && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={onOpenRightPanel}
                >
                  <User className="h-4 w-4" />
                </Button>
              )}
            </>
          ) : (
            // Mobile: Dropdown menu for actions
            <>
              {/* AI Status mini badge */}
              {conversation.ai_handled && !conversation.ai_paused && (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 h-7 px-2">
                  <Bot className="h-3 w-3" />
                </Badge>
              )}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={startEditingName}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Editar nome
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleInvokeAI} disabled={isInvokingAI}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Acionar IA
                  </DropdownMenuItem>
                  {conversation.ai_handled && (
                    <DropdownMenuItem onClick={handleToggleAIPaused}>
                      {conversation.ai_paused ? (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Retomar IA
                        </>
                      ) : (
                        <>
                          <Pause className="h-4 w-4 mr-2" />
                          Pausar IA
                        </>
                      )}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => setShowTransferDialog(true)}>
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                    Transferir
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onOpenRightPanel}>
                    <User className="h-4 w-4 mr-2" />
                    Info do contato
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className={cn(
          "mx-2 md:mx-4 mt-2 justify-start bg-muted/50 p-1 h-auto",
          isMobile ? "flex overflow-x-auto gap-1" : "flex-wrap"
        )}>
          <TabsTrigger value="chat" className="gap-1.5 md:gap-2 data-[state=active]:bg-background text-xs md:text-sm px-2 md:px-3">
            <MessageSquare className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span className={isMobile ? "hidden xs:inline" : ""}>Chat</span>
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-1.5 md:gap-2 data-[state=active]:bg-background text-xs md:text-sm px-2 md:px-3">
            <StickyNote className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span className={isMobile ? "hidden xs:inline" : ""}>Notas</span>
            {notes.length > 0 && <Badge variant="secondary" className="ml-1 h-4 md:h-5 px-1 md:px-1.5 text-[10px] md:text-xs">{notes.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1.5 md:gap-2 data-[state=active]:bg-background text-xs md:text-sm px-2 md:px-3">
            <CheckSquare className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span className={isMobile ? "hidden xs:inline" : ""}>Tarefas</span>
            {pendingTasks.length > 0 && <Badge variant="secondary" className="ml-1 h-4 md:h-5 px-1 md:px-1.5 text-[10px] md:text-xs">{pendingTasks.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="internal" className="gap-1.5 md:gap-2 data-[state=active]:bg-background text-xs md:text-sm px-2 md:px-3">
            <Users className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span className={isMobile ? "hidden xs:inline" : ""}>Interno</span>
            {internalMessages.length > 0 && <Badge className="ml-1 h-4 md:h-5 px-1 md:px-1.5 text-[10px] md:text-xs bg-primary">{internalMessages.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="flex-1 flex flex-col mt-0 overflow-hidden">
      {/* Messages */}
      <ScrollArea 
        className="flex-1 p-3 md:p-4" 
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
      <div className="p-2 md:p-4 border-t border-border bg-card">
        {/* Mobile: Instance selector above input */}
        {isMobile && (
          <div className="mb-2">
            <Select 
              value={selectedInstanceId} 
              onValueChange={async (value) => {
                setSelectedInstanceId(value);
                try {
                  await supabase
                    .from('conversations')
                    .update({ instance_id: value })
                    .eq('id', conversation.id);
                } catch (error) {
                  toast.error("Erro ao atualizar número");
                }
              }}
            >
              <SelectTrigger className="w-full h-8 text-xs">
                <Smartphone className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
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
          </div>
        )}
        
        <div className="flex gap-1.5 md:gap-2 max-w-3xl mx-auto items-end">
          <MediaUploadButton 
            onUpload={(url, type) => handleSendMedia(url, type)} 
            disabled={!selectedInstanceId}
          />
          
          {!isMobile && <EmojiPicker onEmojiSelect={handleEmojiSelect} />}
          
          <Textarea
            ref={textareaRef}
            placeholder="Digite sua mensagem..."
            value={newMessage}
            onChange={handleMessageChange}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-muted/50 min-h-[40px] max-h-[150px] resize-none py-2 text-sm md:text-base"
            rows={1}
          />

          {!isMobile && (
            <AIAssistantButton
              conversationId={conversation.id}
              onSuggestion={handleAISuggestion}
              currentMessage={newMessage}
            />
          )}

          <VoiceRecorder
            onSend={(audioUrl) => handleSendMedia(audioUrl, 'audio')}
            disabled={!selectedInstanceId}
          />
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                onClick={handleSend} 
                disabled={!newMessage.trim() || !selectedInstanceId || isAutoCorrect}
                size={isMobile ? "icon" : "default"}
                className="shrink-0 min-w-[40px] md:min-w-[44px] relative"
              >
                {isAutoCorrect ? (
                  <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 md:h-5 md:w-5" />
                )}
                {autoCorrectEnabled && !isAutoCorrect && (
                  <SpellCheck className="h-2.5 w-2.5 absolute -top-0.5 -right-0.5 text-primary" />
                )}
              </Button>
            </TooltipTrigger>
            {autoCorrectEnabled && (
              <TooltipContent>
                <p>Correção automática ativada</p>
              </TooltipContent>
            )}
          </Tooltip>
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
        </TabsContent>

        <TabsContent value="notes" className="flex-1 mt-0 overflow-hidden">
          <NotesTab conversationId={conversation.id} contactId={conversation.contact_id} />
        </TabsContent>

        <TabsContent value="tasks" className="flex-1 mt-0 overflow-hidden">
          <TasksTab conversationId={conversation.id} contactId={conversation.contact_id} />
        </TabsContent>

        <TabsContent value="internal" className="flex-1 mt-0 overflow-hidden">
          <InternalChatTab conversationId={conversation.id} contactId={conversation.contact_id} />
        </TabsContent>
      </Tabs>
      </div>
      
      {/* Transfer Dialog */}
      <TransferConversationDialog
        open={showTransferDialog}
        onOpenChange={setShowTransferDialog}
        conversationId={conversation.id}
        contactName={conversation.contact?.name || conversation.contact?.phone || "Contato"}
      />
    </div>
  );
};
