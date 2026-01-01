import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { PanelLeft, PanelLeftClose, PanelRight, PanelRightClose, Phone } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ConversationList } from "@/components/inbox/ConversationList";
import { MessageView } from "@/components/inbox/MessageView";
import { EmptyInbox } from "@/components/inbox/EmptyInbox";
import { NewConversationDialog } from "@/components/inbox/NewConversationDialog";
import { RightSidePanel } from "@/components/inbox/RightSidePanel";
import { SoftphoneWidget } from "@/components/softphone/SoftphoneWidget";
import { Conversation, useConversations } from "@/hooks/useConversations";
import { useFusionPBXConfig } from "@/hooks/useFusionPBXConfig";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ImperativePanelHandle } from "react-resizable-panels";

const Inbox = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { conversations, isLoading, markAsRead, refetch } = useConversations();
  const { isConfigured: isVoipConfigured } = useFusionPBXConfig();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [mobileShowMessages, setMobileShowMessages] = useState(false);
  const [showSoftphone, setShowSoftphone] = useState(false);
  const isMobile = useIsMobile();
  
  // Refs for resizable panels
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);
  const rightPanelRef = useRef<ImperativePanelHandle>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);

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

  const handleOpenRightPanel = () => {
    if (rightPanelRef.current && isRightPanelCollapsed) {
      rightPanelRef.current.expand();
    }
  };

  const toggleSidebar = () => {
    if (sidebarPanelRef.current) {
      if (isSidebarCollapsed) {
        sidebarPanelRef.current.expand();
      } else {
        sidebarPanelRef.current.collapse();
      }
    }
  };

  const toggleRightPanel = () => {
    if (rightPanelRef.current) {
      if (isRightPanelCollapsed) {
        rightPanelRef.current.expand();
      } else {
        rightPanelRef.current.collapse();
      }
    }
  };

  return (
    <DashboardLayout className="h-screen flex flex-col">
      {/* Header - hidden on mobile */}
      {!isMobile && (
        <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-card shrink-0">
          <div className="flex items-center gap-3">
            {/* Toggle Sidebar Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={toggleSidebar}
                >
                  {isSidebarCollapsed ? (
                    <PanelLeft className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isSidebarCollapsed ? "Mostrar conversas" : "Ocultar conversas"}
              </TooltipContent>
            </Tooltip>
            
            <div>
              <h1 className="text-lg font-semibold text-foreground">Inbox</h1>
              <p className="text-xs text-muted-foreground">
                Gerencie suas conversas
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Softphone Button */}
            {isVoipConfigured && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showSoftphone ? "default" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setShowSoftphone(!showSoftphone)}
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {showSoftphone ? "Fechar softphone" : "Abrir softphone"}
                </TooltipContent>
              </Tooltip>
            )}
            
            <NewConversationDialog onConversationCreated={handleConversationCreated} />
            
            {/* Toggle Right Panel Button */}
            {selectedConversation && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={toggleRightPanel}
                  >
                    {isRightPanelCollapsed ? (
                      <PanelRight className="h-4 w-4" />
                    ) : (
                      <PanelRightClose className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isRightPanelCollapsed ? "Mostrar painel do lead" : "Ocultar painel"}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </header>
      )}

      {/* Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {isMobile ? (
          // Mobile: Show either list OR messages, not both
          mobileShowMessages && selectedConversation ? (
            <MessageView 
              conversation={selectedConversation} 
              onBack={handleBackToList}
              onOpenRightPanel={handleOpenRightPanel}
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
          // Desktop: Show list AND messages side by side with right panel using resizable panels
          <ResizablePanelGroup 
            direction="horizontal" 
            autoSaveId="inbox-panels"
            className="h-full"
          >
            {/* Sidebar - Conversation List */}
            <ResizablePanel 
              ref={sidebarPanelRef}
              defaultSize={22}
              minSize={15}
              maxSize={35}
              collapsible
              collapsedSize={0}
              onCollapse={() => setIsSidebarCollapsed(true)}
              onExpand={() => setIsSidebarCollapsed(false)}
            >
              <ConversationList
                conversations={conversations || []}
                selectedId={selectedConversation?.id || null}
                onSelect={handleSelectConversation}
                isLoading={isLoading}
              />
            </ResizablePanel>
            
            <ResizableHandle withHandle />
            
            {/* Chat Area */}
            <ResizablePanel defaultSize={selectedConversation ? 48 : 78} minSize={30}>
              {selectedConversation ? (
                <MessageView 
                  conversation={selectedConversation}
                  onOpenRightPanel={handleOpenRightPanel}
                />
              ) : (
                <EmptyInbox />
              )}
            </ResizablePanel>
            
            {/* Right Panel - Funnel + Contact Info */}
            {selectedConversation && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel 
                  ref={rightPanelRef}
                  defaultSize={30}
                  minSize={20}
                  maxSize={45}
                  collapsible
                  collapsedSize={0}
                  onCollapse={() => setIsRightPanelCollapsed(true)}
                  onExpand={() => setIsRightPanelCollapsed(false)}
                >
                  <RightSidePanel
                    conversation={selectedConversation}
                    isOpen={true}
                    onClose={() => rightPanelRef.current?.collapse()}
                  />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        )}
      </div>
      
      {/* Mobile Right Panel as Sheet */}
      {isMobile && selectedConversation && (
        <RightSidePanel
          conversation={selectedConversation}
          isOpen={!isRightPanelCollapsed}
          onClose={() => setIsRightPanelCollapsed(true)}
        />
      )}
      
      {/* Softphone Widget */}
      {showSoftphone && (
        <SoftphoneWidget onClose={() => setShowSoftphone(false)} />
      )}
    </DashboardLayout>
  );
};

export default Inbox;
