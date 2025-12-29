import { useState } from "react";
import { Phone, PhoneCall, Bot, History, Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useVoipConfig } from "@/hooks/useVoipConfig";
import { useVoipCalls } from "@/hooks/useVoipCalls";
import { ActiveCallPanel } from "./ActiveCallPanel";
import { CallHistoryTab } from "./CallHistoryTab";
import { AICallDialog } from "./AICallDialog";
import { useNavigate } from "react-router-dom";

interface PhoneCallButtonProps {
  contactPhone: string;
  contactId?: string;
  conversationId?: string;
  contactName?: string;
}

export const PhoneCallButton = ({
  contactPhone,
  contactId,
  conversationId,
  contactName,
}: PhoneCallButtonProps) => {
  const navigate = useNavigate();
  const { isConfigured, config } = useVoipConfig();
  const { makeCall, activeCall, hasActiveCall, calls } = useVoipCalls(contactId, conversationId);
  const [showHistory, setShowHistory] = useState(false);
  const [showActiveCall, setShowActiveCall] = useState(false);
  const [showAICall, setShowAICall] = useState(false);

  const handleMakeCall = async () => {
    if (!isConfigured) {
      navigate('/settings?tab=integrations');
      return;
    }

    await makeCall.mutateAsync({
      contactPhone,
      contactId,
      conversationId,
      srcNumber: config?.default_src_number || undefined,
      deviceId: config?.default_device_id || undefined,
      useAI: false,
    });

    setShowActiveCall(true);
  };

  const handleMakeAICall = () => {
    setShowAICall(true);
  };

  // If there's an active call for this contact, show it
  if (hasActiveCall && activeCall?.contact_id === contactId) {
    return (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="default"
              size="icon"
              className="h-9 w-9 bg-emerald-500 hover:bg-emerald-600 animate-pulse"
              onClick={() => setShowActiveCall(true)}
            >
              <PhoneCall className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Chamada em andamento</TooltipContent>
        </Tooltip>

        <ActiveCallPanel
          call={activeCall}
          isOpen={showActiveCall}
          onClose={() => setShowActiveCall(false)}
          contactName={contactName}
        />
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                disabled={makeCall.isPending}
              >
                {makeCall.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Phone className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Telefone</TooltipContent>
        </Tooltip>

        <DropdownMenuContent align="end" className="w-48">
          {isConfigured ? (
            <>
              <DropdownMenuItem onClick={handleMakeCall}>
                <Phone className="h-4 w-4 mr-2" />
                Ligar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleMakeAICall}>
                <Bot className="h-4 w-4 mr-2" />
                Ligar com IA
                <Badge variant="outline" className="ml-auto text-[10px]">
                  Beta
                </Badge>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : (
            <>
              <DropdownMenuItem onClick={() => navigate('/settings?tab=integrations')}>
                <Settings className="h-4 w-4 mr-2" />
                Configurar VoIP
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          
          <DropdownMenuItem onClick={() => setShowHistory(true)}>
            <History className="h-4 w-4 mr-2" />
            Histórico de Chamadas
            {calls.length > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {calls.length}
              </Badge>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Call History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Histórico de Chamadas</DialogTitle>
            <DialogDescription>
              {contactName || contactPhone}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <CallHistoryTab 
              contactId={contactId} 
              conversationId={conversationId} 
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Active Call Panel */}
      {activeCall && (
        <ActiveCallPanel
          call={activeCall}
          isOpen={showActiveCall}
          onClose={() => setShowActiveCall(false)}
          contactName={contactName}
        />
      )}

      {/* AI Call Dialog */}
      <AICallDialog
        isOpen={showAICall}
        onClose={() => setShowAICall(false)}
        contactName={contactName}
        contactPhone={contactPhone}
        contactId={contactId}
        conversationId={conversationId}
      />
    </>
  );
};
