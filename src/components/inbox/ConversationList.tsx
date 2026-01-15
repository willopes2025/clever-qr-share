import { format, isToday, isYesterday, subDays, differenceInMinutes, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, MessageCircle, Inbox, Archive, Bot, UserCheck, Target, User, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Conversation } from "@/hooks/useConversations";
import { useState } from "react";
import { ConversationContextMenu } from "./ConversationContextMenu";
import { ConversationQuickActions } from "./ConversationQuickActions";
import { formatForDisplay } from "@/lib/phone-utils";
import { ConversationFiltersComponent, ConversationFilters } from "./ConversationFilters";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ContactIdBadge } from "@/components/contacts/ContactIdBadge";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { ProviderBadge } from "./ProviderBadge";

interface ConversationWithTags extends Conversation {
  tag_assignments?: { tag_id: string }[];
  campaign_id?: string | null;
  ai_handled?: boolean | null;
  ai_paused?: boolean | null;
  ai_handoff_requested?: boolean | null;
  assigned_to?: string | null;
  first_response_at?: string | null;
  provider?: 'evolution' | 'meta' | null;
  meta_phone_number_id?: string | null;
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
    instanceIds: [],
    tagIds: [],
    dateFilter: 'all',
    funnelIds: [],
    stageIds: [],
    responseStatus: 'all',
    assignedToIds: [],
    aiStatus: 'all',
    hasDeal: 'all',
    campaignIds: [],
    isPinned: false,
    provider: 'all',
    metaPhoneNumberId: null,
  });
  
  const { members } = useTeamMembers();
  
  // Helper to get member name by user_id
  const getMemberName = (userId: string | null | undefined) => {
    if (!userId) return null;
    const member = members.find(m => m.user_id === userId);
    return member?.profile?.full_name || member?.email?.split('@')[0] || 'Atribuído';
  };
  
  // Helper to get SLA status color
  const getSLAStatus = (conversation: ConversationWithTags) => {
    // Only check for conversations without first response (not responded yet)
    if (conversation.first_response_at) return null;
    if (!conversation.last_message_at) return null;
    
    const lastMessageDate = new Date(conversation.last_message_at);
    const now = new Date();
    const minutesAgo = differenceInMinutes(now, lastMessageDate);
    const hoursAgo = differenceInHours(now, lastMessageDate);
    
    if (hoursAgo >= 24) return { color: 'bg-red-500', label: '+24h sem resposta' };
    if (hoursAgo >= 1) return { color: 'bg-amber-500', label: `${hoursAgo}h sem resposta` };
    if (minutesAgo >= 15) return { color: 'bg-orange-400', label: `${minutesAgo}min sem resposta` };
    return null;
  };

  // Sort: pinned first, then by last_message_at
  const sortedConversations = [...conversations].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime();
  });

  const filteredConversations = sortedConversations.filter(conv => {
    const name = conv.contact?.name || "";
    const phone = conv.contact?.phone || "";
    const displayId = (conv.contact as any)?.contact_display_id || "";
    const search = searchTerm.toLowerCase();
    const matchesSearch = name.toLowerCase().includes(search) || phone.includes(search) || displayId.includes(search);
    
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

    // Apply instance filter - multi-select with strict matching
    if (filters.instanceIds.length > 0) {
      if (!conv.instance_id) return false;
      if (!filters.instanceIds.includes(conv.instance_id)) return false;
    }

    // Apply tag filter - multi-select (OR logic: conversation has at least one selected tag)
    if (filters.tagIds.length > 0) {
      const hasAnyTag = conv.tag_assignments?.some(ta => filters.tagIds.includes(ta.tag_id));
      if (!hasAnyTag) return false;
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

    // Apply funnel filter - multi-select
    if (filters.funnelIds.length > 0) {
      if (!conv.deal || !filters.funnelIds.includes(conv.deal.funnel_id)) return false;
    }

    // Apply stage filter (multi-select)
    if (filters.stageIds.length > 0) {
      if (!conv.deal || !filters.stageIds.includes(conv.deal.stage_id)) return false;
    }

    // Apply response status filter
    if (filters.responseStatus !== 'all') {
      const lastMsgDate = conv.last_message_at ? new Date(conv.last_message_at) : null;
      const now = new Date();
      
      if (filters.responseStatus === 'no_response') {
        if (conv.first_response_at) return false;
      } else {
        const minutesThreshold: Record<string, number> = {
          '15min': 15,
          '1h': 60,
          '4h': 240,
          '24h': 1440,
        };
        const threshold = minutesThreshold[filters.responseStatus];
        if (!lastMsgDate || conv.first_response_at) return false;
        if (differenceInMinutes(now, lastMsgDate) < threshold) return false;
      }
    }

    // Apply assigned to filter - multi-select with special handling for 'unassigned'
    if (filters.assignedToIds.length > 0) {
      const hasUnassigned = filters.assignedToIds.includes('unassigned');
      const specificAssignees = filters.assignedToIds.filter(id => id !== 'unassigned');
      
      // Check if conversation matches any of the selected criteria
      const matchesUnassigned = hasUnassigned && !conv.assigned_to;
      const matchesSpecific = specificAssignees.length > 0 && conv.assigned_to && specificAssignees.includes(conv.assigned_to);
      
      if (!matchesUnassigned && !matchesSpecific) return false;
    }

    // Apply AI status filter
    if (filters.aiStatus !== 'all') {
      if (filters.aiStatus === 'no_ai' && conv.ai_handled) return false;
      if (filters.aiStatus === 'ai_active' && (!conv.ai_handled || conv.ai_paused)) return false;
      if (filters.aiStatus === 'ai_paused' && !conv.ai_paused) return false;
      if (filters.aiStatus === 'handoff' && !conv.ai_handoff_requested) return false;
    }

    // Apply has deal filter
    if (filters.hasDeal !== 'all') {
      if (filters.hasDeal === 'with_deal' && !conv.deal) return false;
      if (filters.hasDeal === 'without_deal' && conv.deal) return false;
    }

    // Apply campaign filter - multi-select
    if (filters.campaignIds.length > 0) {
      if (!conv.campaign_id || !filters.campaignIds.includes(conv.campaign_id)) return false;
    }

    // Apply pinned filter
    if (filters.isPinned && !conv.is_pinned) {
      return false;
    }

    // Apply provider filter
    if (filters.provider !== 'all') {
      const convProvider = conv.provider || (conv.instance_id ? 'evolution' : 'meta');
      if (convProvider !== filters.provider) return false;
    }

    // Apply Meta phone number filter
    if (filters.metaPhoneNumberId && conv.meta_phone_number_id !== filters.metaPhoneNumberId) {
      return false;
    }

    return matchesSearch;
  });

  const unreadCount = conversations.filter(c => c.unread_count > 0 && c.status !== "archived").length;

  return (
    <div className="w-full border-r border-border flex flex-col h-full bg-card">
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
            {filteredConversations.map((conversation) => (
              <ConversationContextMenu
                key={conversation.id}
                conversationId={conversation.id}
                isArchived={conversation.status === 'archived'}
                isPinned={conversation.is_pinned || false}
              >
                <div
                  className={cn(
                    "group w-full flex items-start gap-3 p-3 rounded-xl transition-colors duration-150 text-left mb-1 cursor-pointer",
                    selectedId === conversation.id
                      ? "bg-primary/10 border border-primary/20 shadow-sm"
                      : "hover:bg-muted/50"
                  )}
                  onClick={() => onSelect(conversation)}
                >
                    {/* Avatar */}
                    <div className="relative">
                      <Avatar className="w-12 h-12 shrink-0">
                        {conversation.contact?.avatar_url && (
                          <AvatarImage 
                            src={conversation.contact.avatar_url} 
                            alt={conversation.contact?.name || "Contato"} 
                          />
                        )}
                        <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-primary-foreground font-medium">
                          {(conversation.contact?.name || conversation.contact?.phone || "?")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
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
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className={cn(
                            "font-medium truncate",
                            conversation.unread_count > 0 ? "text-foreground" : "text-foreground/80"
                          )}>
                            {conversation.contact?.name || "Contato Desconhecido"}
                          </span>
                          <span className={cn(
                            "text-[11px] whitespace-nowrap shrink-0",
                            conversation.unread_count > 0 ? "text-primary font-medium" : "text-muted-foreground"
                          )}>
                            {formatMessageTime(conversation.last_message_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <ConversationQuickActions
                            conversationId={conversation.id}
                            isPinned={conversation.is_pinned || false}
                            contactName={conversation.contact?.name || "Contato Desconhecido"}
                            contactPhone={conversation.contact?.phone || ""}
                          />
                        </div>
                      </div>
                      {/* Contact ID + Phone Number + Provider Badge */}
                      <div className="flex items-center gap-2 mb-0.5">
                        <ProviderBadge 
                          provider={(conversation as any).provider || (conversation.instance_id ? 'evolution' : 'meta')} 
                          size="sm" 
                        />
                        {(conversation.contact as any)?.contact_display_id && (
                          <ContactIdBadge displayId={(conversation.contact as any).contact_display_id} size="sm" />
                        )}
                        <p className="text-xs text-muted-foreground truncate">
                          {formatForDisplay(conversation.contact?.phone || "")}
                        </p>
                      </div>
                      {/* Assigned + SLA Badges */}
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        {/* Assigned To Badge */}
                        {conversation.assigned_to && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="secondary" className="h-4 px-1.5 text-[9px] gap-0.5">
                                <User className="h-2.5 w-2.5" />
                                {getMemberName(conversation.assigned_to)}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>Responsável: {getMemberName(conversation.assigned_to)}</TooltipContent>
                          </Tooltip>
                        )}
                        {/* SLA Warning Badge */}
                        {(() => {
                          const slaStatus = getSLAStatus(conversation);
                          if (!slaStatus) return null;
                          return (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className={cn("h-4 px-1.5 text-[9px] gap-0.5 border-0 text-white", slaStatus.color)}>
                                  <Clock className="h-2.5 w-2.5" />
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>{slaStatus.label}</TooltipContent>
                            </Tooltip>
                          );
                        })()}
                      </div>
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
                  </div>
                </ConversationContextMenu>
              ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
