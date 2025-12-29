import { useState } from "react";
import { Bot, Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AICallInterface } from "./AICallInterface";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AICallDialogProps {
  isOpen: boolean;
  onClose: () => void;
  contactName?: string;
  contactPhone: string;
  contactId?: string;
  conversationId?: string;
}

// Default ElevenLabs agent ID - user can configure their own
const DEFAULT_AGENT_ID = "";

export const AICallDialog = ({
  isOpen,
  onClose,
  contactName,
  contactPhone,
  contactId,
  conversationId,
}: AICallDialogProps) => {
  const [agentId, setAgentId] = useState(DEFAULT_AGENT_ID);
  const [isCallActive, setIsCallActive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const handleStartCall = () => {
    if (!agentId.trim()) {
      setShowSettings(true);
      toast.error("Configure o Agent ID do ElevenLabs primeiro");
      return;
    }
    setIsCallActive(true);
  };

  const handleEndCall = async () => {
    setIsCallActive(false);
    onClose();
  };

  const handleTranscriptUpdate = async (transcript: string) => {
    // Update the call transcript in the database
    if (conversationId) {
      try {
        // For now, we'll log the transcript - in production, save to voip_calls
        console.log("Transcript update:", transcript);
      } catch (error) {
        console.error("Error saving transcript:", error);
      }
    }
  };

  const handleClose = () => {
    if (isCallActive) {
      // Don't close if call is active - user must end call first
      toast.info("Encerre a chamada primeiro");
      return;
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Chamada com IA
          </DialogTitle>
          <DialogDescription>
            {contactName || contactPhone}
          </DialogDescription>
        </DialogHeader>

        {!isCallActive ? (
          <div className="space-y-4 py-4">
            {/* Agent ID Configuration */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="agentId">ElevenLabs Agent ID</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSettings(!showSettings)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
              
              {(showSettings || !agentId) && (
                <Input
                  id="agentId"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  placeholder="Insira o Agent ID do ElevenLabs"
                  className="font-mono text-sm"
                />
              )}
              
              {!agentId && (
                <p className="text-xs text-muted-foreground">
                  Você precisa criar um agente no{" "}
                  <a
                    href="https://elevenlabs.io/app/conversational-ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    ElevenLabs
                  </a>{" "}
                  e inserir o ID aqui.
                </p>
              )}
            </div>

            {/* Start Call Button */}
            <Button
              onClick={handleStartCall}
              className="w-full"
              size="lg"
            >
              <Bot className="h-5 w-5 mr-2" />
              Iniciar Chamada com IA
            </Button>
          </div>
        ) : (
          <AICallInterface
            agentId={agentId}
            contactName={contactName}
            contactPhone={contactPhone}
            onTranscriptUpdate={handleTranscriptUpdate}
            onEnd={handleEndCall}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
