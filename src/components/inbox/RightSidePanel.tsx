import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Conversation } from "@/hooks/useConversations";
import { useIsMobile } from "@/hooks/use-mobile";

// New lead panel components
import { LeadPanelHeader } from "./lead-panel/LeadPanelHeader";
import { LeadPanelTagsSection } from "./lead-panel/LeadPanelTagsSection";
import { LeadPanelFunnelBar } from "./lead-panel/LeadPanelFunnelBar";
import { LeadPanelTabs } from "./lead-panel/LeadPanelTabs";
import { LeadPanelTabContent } from "./lead-panel/LeadPanelTabContent";
import { LeadPanelContactInfo } from "./lead-panel/LeadPanelContactInfo";
import { LeadPanelNotes } from "./lead-panel/LeadPanelNotes";

interface RightSidePanelProps {
  conversation: Conversation;
  isOpen: boolean;
  onClose: () => void;
}

export const RightSidePanel = ({ conversation, isOpen, onClose }: RightSidePanelProps) => {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<string | null>(null);

  // Reset tab when conversation changes
  useEffect(() => {
    setActiveTab(null);
  }, [conversation.id]);

  const panelContent = (
    <div className="h-full flex flex-col bg-card">
      {/* Header with contact name */}
      <LeadPanelHeader 
        conversation={conversation} 
        onClose={isMobile ? onClose : undefined}
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
      {/* Desktop close button */}
      <div className="absolute top-2 right-2 z-10">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      {panelContent}
    </div>
  );
};
