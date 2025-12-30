import { useState } from "react";
import { ChevronRight, User, Target, EyeOff, Eye, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { motion, AnimatePresence } from "framer-motion";
import { Conversation } from "@/hooks/useConversations";
import { FunnelDealSection } from "./FunnelDealSection";
import { ContactInfoContent } from "./ContactInfoContent";
import { useIsMobile } from "@/hooks/use-mobile";
import { AssigneeSelector } from "@/components/calendar/AssigneeSelector";
import { useLeadDistribution } from "@/hooks/useLeadDistribution";

interface RightSidePanelProps {
  conversation: Conversation;
  isOpen: boolean;
  onClose: () => void;
}

export const RightSidePanel = ({ conversation, isOpen, onClose }: RightSidePanelProps) => {
  const [showFunnel, setShowFunnel] = useState(true);
  const [showContactInfo, setShowContactInfo] = useState(true);
  const isMobile = useIsMobile();
  const { assignConversation } = useLeadDistribution();

  const panelContent = (
    <div className="h-full flex flex-col">
      {/* Header */}
      {!isMobile && (
        <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-sm">Painel do Lead</h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* Responsável Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-2">
              <UserCheck className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Responsável</span>
            </div>
            <div className="px-2">
              <AssigneeSelector
                value={conversation.assigned_to || null}
                onChange={(memberId) => {
                  assignConversation.mutate({
                    conversationId: conversation.id,
                    memberId: memberId || '',
                  });
                }}
                compact
              />
            </div>
          </div>

          <Separator />

          {/* Funnel Section - Always visible when active */}
          <Collapsible open={showFunnel} onOpenChange={setShowFunnel}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full justify-between h-8 px-2 hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Funil de Vendas</span>
                </div>
                {showFunnel ? (
                  <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pt-2">
                <FunnelDealSection 
                  contactId={conversation.contact_id}
                  conversationId={conversation.id}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Contact Info Section - Collapsible */}
          <Collapsible open={showContactInfo} onOpenChange={setShowContactInfo}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full justify-between h-8 px-2 hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Informações do Contato</span>
                </div>
                {showContactInfo ? (
                  <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pt-2">
                <ContactInfoContent conversation={conversation} />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  );

  // Mobile: Use Sheet (drawer from right)
  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          <SheetHeader className="p-4 border-b border-border">
            <SheetTitle>Painel do Lead</SheetTitle>
          </SheetHeader>
          {panelContent}
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Animated side panel
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="border-l border-border bg-card overflow-hidden shrink-0 h-full"
        >
          {panelContent}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
