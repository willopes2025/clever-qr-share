import { useState, useEffect } from "react";
import { ChevronRight, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Conversation } from "@/hooks/useConversations";
import { useIsMobile } from "@/hooks/use-mobile";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// New lead panel components
import { LeadPanelHeader } from "./lead-panel/LeadPanelHeader";
import { LeadPanelTagsSection } from "./lead-panel/LeadPanelTagsSection";
import { LeadPanelFunnelBar } from "./lead-panel/LeadPanelFunnelBar";
import { LeadPanelTabs } from "./lead-panel/LeadPanelTabs";
import { LeadPanelTabContent } from "./lead-panel/LeadPanelTabContent";
import { LeadPanelContactInfo } from "./lead-panel/LeadPanelContactInfo";
import { LeadPanelNotes } from "./lead-panel/LeadPanelNotes";
import { ActivityTimeline } from "./ActivityTimeline";

interface RightSidePanelProps {
  conversation: Conversation;
  isOpen: boolean;
  onClose: () => void;
}

export const RightSidePanel = ({ conversation, isOpen, onClose }: RightSidePanelProps) => {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [isActivityOpen, setIsActivityOpen] = useState(false);

  // Reset tab when conversation changes
  useEffect(() => {
    setActiveTab(null);
    setIsActivityOpen(false);
  }, [conversation.id]);

  const panelContent = (
    <div className="h-full flex flex-col bg-card">
      {/* Header with contact name */}
      <LeadPanelHeader 
        conversation={conversation} 
        onClose={onClose}
        isMobile={isMobile}
      />

      <ScrollArea className="flex-1">
        {/* Tags Section */}
        <LeadPanelTagsSection conversationId={conversation.id} />

        {/* Funnel Bar */}
        <LeadPanelFunnelBar 
          contactId={conversation.contact_id} 
          conversationId={conversation.id}
        />

        {/* Custom Tabs */}
        <LeadPanelTabs 
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Tab Content (Custom Fields) */}
        <LeadPanelTabContent 
          conversation={conversation}
          activeTabId={activeTab}
        />

        {/* Contact Info */}
        <LeadPanelContactInfo conversation={conversation} />

        {/* Notes */}
        <LeadPanelNotes conversation={conversation} />

        {/* Activity History */}
        <Collapsible open={isActivityOpen} onOpenChange={setIsActivityOpen} className="px-3 py-2 border-t border-border/50">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between h-9 px-2 text-sm font-medium">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <span>Histórico de Atividades</span>
              </div>
              <ChevronRight className={`h-4 w-4 transition-transform ${isActivityOpen ? 'rotate-90' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <ActivityTimeline contactId={conversation.contact_id} />
          </CollapsibleContent>
        </Collapsible>
      </ScrollArea>
    </div>
  );

  // Mobile: Use Sheet (drawer from right)
  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Painel do Lead</SheetTitle>
          </SheetHeader>
          {panelContent}
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Simple panel
  return (
    <div className="h-full w-full border-l border-border/50 bg-card overflow-hidden">
      {panelContent}
    </div>
  );
};
