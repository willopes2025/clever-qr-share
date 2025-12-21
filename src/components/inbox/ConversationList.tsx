import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, MessageCircle, Inbox, Archive, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Conversation } from "@/hooks/useConversations";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (conversation: Conversation) => void;
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

  const filteredConversations = conversations.filter(conv => {
    const name = conv.contact?.name || "";
    const phone = conv.contact?.phone || "";
    const search = searchTerm.toLowerCase();
    const matchesSearch = name.toLowerCase().includes(search) || phone.includes(search);
    
    // Apply tab filter
    if (activeTab === "unread") {
      return matchesSearch && conv.unread_count > 0;
    }
    if (activeTab === "archived") {
      return matchesSearch && conv.status === "archived";
    }
    return matchesSearch && conv.status !== "archived";
  });

  const unreadCount = conversations.filter(c => c.unread_count > 0 && c.status !== "archived").length;

  return (
    <div className="w-80 border-r border-border flex flex-col h-full bg-card">
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

        {/* Filter Tabs */}
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
            <AnimatePresence mode="popLayout">
              {filteredConversations.map((conversation, index) => (
                <motion.button
                  key={conversation.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: index * 0.02 }}
                  onClick={() => onSelect(conversation)}
                  className={cn(
                    "w-full flex items-start gap-3 p-3 rounded-xl transition-all duration-200 text-left mb-1",
                    selectedId === conversation.id
                      ? "bg-primary/10 border border-primary/20 shadow-sm"
                      : "hover:bg-muted/50 hover:scale-[1.01]"
                  )}
                >
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground font-medium shrink-0">
                      {(conversation.contact?.name || conversation.contact?.phone || "?")[0].toUpperCase()}
                    </div>
                    {conversation.unread_count > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-primary rounded-full border-2 border-card" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn(
                        "font-medium truncate",
                        conversation.unread_count > 0 ? "text-foreground" : "text-foreground/80"
                      )}>
                        {conversation.contact?.name || conversation.contact?.phone || "Contato Desconhecido"}
                      </span>
                      <span className={cn(
                        "text-xs shrink-0 ml-2",
                        conversation.unread_count > 0 ? "text-primary font-medium" : "text-muted-foreground"
                      )}>
                        {formatMessageTime(conversation.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={cn(
                        "text-sm truncate flex-1",
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
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
