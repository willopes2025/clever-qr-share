import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ConversationList } from "@/components/inbox/ConversationList";
import { MessageView } from "@/components/inbox/MessageView";
import { EmptyInbox } from "@/components/inbox/EmptyInbox";
import { NewConversationDialog } from "@/components/inbox/NewConversationDialog";
import { Conversation, useConversations } from "@/hooks/useConversations";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";

const Inbox = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { conversations, isLoading, markAsRead, refetch } = useConversations();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [mobileShowMessages, setMobileShowMessages] = useState(false);
  const isMobile = useIsMobile();

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
        if (isMobile) setMobileShowMessages(true);
        // Clear params after selection
        setSearchParams({});
      }
    } else if (contactId) {
      const conv = conversations.find(c => c.contact_id === contactId);
      if (conv && selectedConversationId !== conv.id) {
        setSelectedConversationId(conv.id);
        if (isMobile) setMobileShowMessages(true);
        // Clear params after selection
        setSearchParams({});
      }
    }
  }, [conversations, searchParams, setSearchParams, selectedConversationId, isMobile]);

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
    if (isMobile) {
      setMobileShowMessages(true);
    }
    if (conversation.unread_count > 0) {
      markAsRead.mutate(conversation.id);
    }
  };

  const handleBackToList = () => {
    setMobileShowMessages(false);
  };

  const handleConversationCreated = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    if (isMobile) {
      setMobileShowMessages(true);
    }
    refetch();
  };

  return (
    <DashboardLayout className="h-screen flex flex-col">
      {/* Header - hidden on mobile */}
      {!isMobile && (
        <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-card shrink-0">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Inbox</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie todas as suas conversas em um só lugar
            </p>
          </div>
          <NewConversationDialog onConversationCreated={handleConversationCreated} />
        </header>
      )}

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {isMobile ? (
          // Mobile: Show either list OR messages, not both
          mobileShowMessages && selectedConversation ? (
            <MessageView 
              conversation={selectedConversation} 
              onBack={handleBackToList}
            />
          ) : (
            <div className="flex-1 flex flex-col">
              {/* Mobile header for conversation list */}
              <div className="p-3 border-b border-border bg-card flex items-center justify-between">
                <h1 className="text-lg font-semibold text-foreground">Conversas</h1>
                <NewConversationDialog onConversationCreated={handleConversationCreated} />
              </div>
              <ConversationList
                conversations={conversations || []}
                selectedId={selectedConversation?.id || null}
                onSelect={handleSelectConversation}
                isLoading={isLoading}
              />
            </div>
          )
        ) : (
          // Desktop: Show list AND messages side by side
          <>
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
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Inbox;
