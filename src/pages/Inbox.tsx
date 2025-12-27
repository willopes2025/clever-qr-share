import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ConversationList } from "@/components/inbox/ConversationList";
import { MessageView } from "@/components/inbox/MessageView";
import { EmptyInbox } from "@/components/inbox/EmptyInbox";
import { NewConversationDialog } from "@/components/inbox/NewConversationDialog";
import { Conversation, useConversations } from "@/hooks/useConversations";
import { supabase } from "@/integrations/supabase/client";

const Inbox = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { conversations, isLoading, markAsRead, refetch } = useConversations();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  // Handle selection from URL params (reactive to changes)
  useEffect(() => {
    if (!conversations || conversations.length === 0) return;
    
    // Support both 'conversationId' and 'conversation' params for compatibility
    const conversationId = searchParams.get('conversationId') || searchParams.get('conversation');
    const contactId = searchParams.get('contactId');
    
    if (conversationId) {
      const conv = conversations.find(c => c.id === conversationId);
      if (conv && selectedConversationId !== conv.id) {
        setSelectedConversationId(conv.id);
        // Clear params after selection
        setSearchParams({});
      }
    } else if (contactId) {
      const conv = conversations.find(c => c.contact_id === contactId);
      if (conv && selectedConversationId !== conv.id) {
        setSelectedConversationId(conv.id);
        // Clear params after selection
        setSearchParams({});
      }
    }
  }, [conversations, searchParams, setSearchParams, selectedConversationId]);

  // Keep the selected conversation in sync with updated data
  const selectedConversation = useMemo(() => {
    if (!selectedConversationId) return null;
    return conversations?.find(c => c.id === selectedConversationId) || null;
  }, [conversations, selectedConversationId]);

  // Real-time subscription for conversations
  useEffect(() => {
    const channel = supabase
      .channel('conversations-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversationId(conversation.id);
    if (conversation.unread_count > 0) {
      markAsRead.mutate(conversation.id);
    }
  };

  const handleConversationCreated = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    refetch();
  };

  return (
    <DashboardLayout className="h-screen flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-card shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Inbox</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie todas as suas conversas em um só lugar
          </p>
        </div>
        <NewConversationDialog onConversationCreated={handleConversationCreated} />
      </header>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        <ConversationList
          conversations={conversations || []}
          selectedId={selectedConversation?.id || null}
          onSelect={handleSelectConversation}
          isLoading={isLoading}
        />
        
        {selectedConversation ? (
          <MessageView conversation={selectedConversation} />
        ) : (
          <EmptyInbox />
        )}
      </div>
    </DashboardLayout>
  );
};

export default Inbox;