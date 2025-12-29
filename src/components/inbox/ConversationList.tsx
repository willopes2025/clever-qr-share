import { format, isToday, isYesterday, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, MessageCircle, Inbox, Archive, Bot, UserCheck, Target } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Conversation } from "@/hooks/useConversations";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ConversationContextMenu } from "./ConversationContextMenu";
import { ConversationQuickActions } from "./ConversationQuickActions";
import { formatForDisplay } from "@/lib/phone-utils";
import { ConversationFiltersComponent, ConversationFilters } from "./ConversationFilters";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ConversationWithTags extends Conversation {
  tag_assignments?: { tag_id: string }[];
  campaign_id?: string | null;
  ai_handled?: boolean | null;
  ai_paused?: boolean | null;
  ai_handoff_requested?: boolean | null;
}

interface ConversationListProps {
  conversations: ConversationWithTags[];
  selectedId: string | null;
  onSelect: (conversation: ConversationWithTags) => void;
  isLoading: boolean;
}

const formatMessageTime = (dateString: string | null) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  
  if (isToday(date)) {
    return format(date, "HH:mm");
  }
  if (isYesterday(date)) {
    return "Ontem";
  }
  return format(date, "dd/MM", { locale: ptBR });
};

type FilterTab = "all" | "unread" | "archived";

export const ConversationList = ({ 
  conversations, 
  selectedId, 
  onSelect, 
  isLoading 
}: ConversationListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [filters, setFilters] = useState<ConversationFilters>({
    instanceId: null,
    tagId: null,
    dateFilter: 'all',
    funnelId: null,
    stageIds: [],
  });

  // Sort: pinned first, then by last_message_at
  const sortedConversations = [...conversations].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime();
  });

  const filteredConversations = sortedConversations.filter(conv => {
    const name = conv.contact?.name || "";
    const phone = conv.contact?.phone || "";
    const search = searchTerm.toLowerCase();
    const matchesSearch = name.toLowerCase().includes(search) || phone.includes(search);
    
    // Apply tab filter
    if (activeTab === "unread") {
      if (conv.unread_count <= 0) return false;
    }
    if (activeTab === "archived") {
      if (conv.status !== "archived") return false;
    }
    if (activeTab === "all") {
      if (conv.status === "archived") return false;
    }

    // Apply instance filter
    if (filters.instanceId && conv.instance_id !== filters.instanceId) {
      return false;
    }

    // Apply tag filter
    if (filters.tagId) {
      const hasTag = conv.tag_assignments?.some(ta => ta.tag_id === filters.tagId);
      if (!hasTag) return false;
    }

    // Apply date filter
    if (filters.dateFilter !== 'all' && conv.last_message_at) {
      const messageDate = new Date(conv.last_message_at);
      const now = new Date();
      
      if (filters.dateFilter === 'today') {
        if (!isToday(messageDate)) return false;
      } else if (filters.dateFilter === '7days') {
        if (messageDate < subDays(now, 7)) return false;
      } else if (filters.dateFilter === '30days') {
        if (messageDate < subDays(now, 30)) return false;
      }
    }

    // Apply funnel filter
    if (filters.funnelId) {
      if (!conv.deal || conv.deal.funnel_id !== filters.funnelId) return false;
    }

    // Apply stage filter (multi-select)
    if (filters.stageIds.length > 0) {
      if (!conv.deal || !filters.stageIds.includes(conv.deal.stage_id)) return false;
    }

    return matchesSearch;
  });

  const unreadCount = conversations.filter(c => c.unread_count > 0 && c.status !== "archived").length;

  return (
    <div className="w-full md:w-80 border-r border-border flex flex-col h-full bg-card">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Conversas</h2>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-muted/50"
          />
        </div>

        {/* Filters */}
        <ConversationFiltersComponent filters={filters} onFiltersChange={setFilters} />
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
          <TabsList className="grid w-full grid-cols-3 h-9">
            <TabsTrigger value="all" className="text-xs gap-1.5">
              <Inbox className="h-3.5 w-3.5" />
              Todas
            </TabsTrigger>
            <TabsTrigger value="unread" className="text-xs gap-1.5 relative">
              <MessageCircle className="h-3.5 w-3.5" />
              Não lidas
              {unreadCount > 0 && (
                <Badge 
                  variant="default" 
                  className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] bg-primary"
                >
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="archived" className="text-xs gap-1.5">
              <Archive className="h-3.5 w-3.5" />
              Arquivadas
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse flex gap-3">
                <div className="w-12 h-12 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-8 text-center">
            <MessageCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              {searchTerm 
                ? "Nenhuma conversa encontrada" 
                : activeTab === "unread"
                  ? "Nenhuma mensagem não lida"
                  : activeTab === "archived"
                    ? "Nenhuma conversa arquivada"
                    : "Nenhuma conversa ainda"}
            </p>
          </div>
        ) : (
          <div className="p-2">
            <AnimatePresence mode="sync">
              {filteredConversations.map((conversation) => (
                <ConversationContextMenu
                  key={conversation.id}
                  conversationId={conversation.id}
                  isArchived={conversation.status === 'archived'}
                  isPinned={conversation.is_pinned || false}
                >
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className={cn(
                      "group w-full flex items-start gap-3 p-3 rounded-xl transition-colors duration-200 text-left mb-1 cursor-pointer",
                      selectedId === conversation.id
                        ? "bg-primary/10 border border-primary/20 shadow-sm"
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => onSelect(conversation)}
                  >
                    {/* Avatar */}
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground font-medium shrink-0">
                        {(conversation.contact?.name || conversation.contact?.phone || "?")[0].toUpperCase()}
                      </div>
                      {conversation.unread_count > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-primary rounded-full border-2 border-card" />
                      )}
                      {conversation.is_pinned && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-amber-500 rounded-full border-2 border-card flex items-center justify-center text-[8px] text-white">📌</span>
                      )}
                      {/* AI Badge */}
                      {conversation.ai_handled && !conversation.ai_paused && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="absolute -top-0.5 -left-0.5 w-5 h-5 bg-emerald-500 rounded-full border-2 border-card flex items-center justify-center">
                              <Bot className="h-3 w-3 text-white" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>IA Atendendo</TooltipContent>
                        </Tooltip>
                      )}
                      {conversation.ai_handoff_requested && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="absolute -top-0.5 -left-0.5 w-5 h-5 bg-amber-500 rounded-full border-2 border-card flex items-center justify-center animate-pulse">
                              <UserCheck className="h-3 w-3 text-white" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Aguardando Atendente</TooltipContent>
                        </Tooltip>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className={cn(
                          "font-medium truncate min-w-0",
                          conversation.unread_count > 0 ? "text-foreground" : "text-foreground/80"
                        )}>
                          {conversation.contact?.name || "Contato Desconhecido"}
                        </span>
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          <span className={cn(
                            "text-[11px] whitespace-nowrap",
                            conversation.unread_count > 0 ? "text-primary font-medium" : "text-muted-foreground"
                          )}>
                            {formatMessageTime(conversation.last_message_at)}
                          </span>
                          <div className="md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <ConversationQuickActions
                              conversationId={conversation.id}
                              isPinned={conversation.is_pinned || false}
                              contactName={conversation.contact?.name || "Contato Desconhecido"}
                              contactPhone={conversation.contact?.phone || ""}
                            />
                          </div>
                        </div>
                      </div>
                      {/* Phone Number - Always visible */}
                      <p className="text-xs text-muted-foreground truncate mb-0.5">
                        {formatForDisplay(conversation.contact?.phone || "")}
                      </p>
                      {/* Funnel/Stage Badge */}
                      {conversation.deal && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 mb-0.5 max-w-full overflow-hidden">
                              <Target className="h-3 w-3 shrink-0 text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground truncate">
                                {conversation.deal.funnel_name}
                              </span>
                              <Badge 
                                variant="outline" 
                                className="h-4 px-1.5 text-[9px] shrink-0 border"
                                style={{ 
                                  borderColor: conversation.deal.stage_color || undefined,
                                  color: conversation.deal.stage_color || undefined
                                }}
                              >
                                {conversation.deal.stage_name}
                              </Badge>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {conversation.deal.funnel_name} → {conversation.deal.stage_name}
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <div className="flex items-center gap-2">
                          <p className={cn(
                            "text-sm truncate flex-1 min-w-0",
                            conversation.unread_count > 0 
                              ? "text-foreground font-medium" 
                              : "text-muted-foreground"
                          )}>
                            {conversation.last_message_preview || "Sem mensagens"}
                          </p>
                        {conversation.unread_count > 0 && (
                          <Badge 
                            variant="default" 
                            className="bg-primary text-primary-foreground text-xs px-2 py-0.5 shrink-0 min-w-5 justify-center"
                          >
                            {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </ConversationContextMenu>
              ))}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
