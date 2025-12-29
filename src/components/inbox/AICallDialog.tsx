import { useState, useEffect } from "react";
import { Bot, Settings, User, Sparkles } from "lucide-react";
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
import { toast } from "sonner";
import { useAllAgentConfigs, AIAgentConfig } from "@/hooks/useAIAgentConfig";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface AICallDialogProps {
  isOpen: boolean;
  onClose: () => void;
  contactName?: string;
  contactPhone: string;
  contactId?: string;
  conversationId?: string;
}

export const AICallDialog = ({
  isOpen,
  onClose,
  contactName,
  contactPhone,
  contactId,
  conversationId,
}: AICallDialogProps) => {
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [customAgentId, setCustomAgentId] = useState("");
  const [useCustomAgent, setUseCustomAgent] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AIAgentConfig | null>(null);

  const { data: agents, isLoading: agentsLoading } = useAllAgentConfigs();

  // Update selected agent when selection changes
  useEffect(() => {
    if (selectedAgentId && agents) {
      const agent = agents.find(a => a.id === selectedAgentId);
      setSelectedAgent(agent || null);
    } else {
      setSelectedAgent(null);
    }
  }, [selectedAgentId, agents]);

  const getElevenLabsAgentId = (): string => {
    if (useCustomAgent) {
      return customAgentId.trim();
    }
    return selectedAgent?.elevenlabs_agent_id || "";
  };

  const handleStartCall = () => {
    const agentId = getElevenLabsAgentId();
    
    if (!agentId) {
      if (useCustomAgent) {
        toast.error("Insira o Agent ID do ElevenLabs");
      } else if (selectedAgent) {
        toast.error("Este agente não possui Agent ID do ElevenLabs configurado. Configure na Central de Agentes ou use um ID customizado.");
      } else {
        toast.error("Selecione um agente ou insira um Agent ID customizado");
      }
      return;
    }
    
    setIsCallActive(true);
  };

  const handleEndCall = async () => {
    setIsCallActive(false);
    onClose();
  };

  const handleTranscriptUpdate = async (transcript: string) => {
    if (conversationId) {
      console.log("Transcript update:", transcript);
    }
  };

  const handleClose = () => {
    if (isCallActive) {
      toast.info("Encerre a chamada primeiro");
      return;
    }
    onClose();
  };

  const getTemplateLabel = (type: string | null) => {
    const labels: Record<string, string> = {
      sdr: "SDR",
      support: "Suporte",
      scheduler: "Agendador",
      qualifier: "Qualificador",
      receptionist: "Recepção",
    };
    return labels[type || ""] || type || "Personalizado";
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
            {/* Agent Selection */}
            <div className="space-y-3">
              <Label>Selecione o Agente</Label>
              
              {/* Configured Agents */}
              <Select
                value={useCustomAgent ? "" : selectedAgentId}
                onValueChange={(value) => {
                  setSelectedAgentId(value);
                  setUseCustomAgent(false);
                }}
                disabled={agentsLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={agentsLoading ? "Carregando agentes..." : "Escolha um agente configurado"} />
                </SelectTrigger>
                <SelectContent>
                  {agents?.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>{agent.agent_name}</span>
                        {agent.template_type && (
                          <Badge variant="secondary" className="ml-1 text-xs">
                            {getTemplateLabel(agent.template_type)}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Selected Agent Preview */}
              {selectedAgent && !useCustomAgent && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{selectedAgent.agent_name}</span>
                    {selectedAgent.elevenlabs_agent_id ? (
                      <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-600/30">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Agent ID Configurado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-600/30">
                        Sem Agent ID
                      </Badge>
                    )}
                  </div>
                  {selectedAgent.personality_prompt && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {selectedAgent.personality_prompt}
                    </p>
                  )}
                </div>
              )}

              <Separator className="my-2" />

              {/* Custom Agent ID Option */}
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => setUseCustomAgent(!useCustomAgent)}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  {useCustomAgent ? "Usar agente configurado" : "Usar Agent ID customizado"}
                </Button>

                {useCustomAgent && (
                  <div className="space-y-2">
                    <Input
                      value={customAgentId}
                      onChange={(e) => setCustomAgentId(e.target.value)}
                      placeholder="Insira o Agent ID do ElevenLabs"
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Crie um agente no{" "}
                      <a
                        href="https://elevenlabs.io/app/conversational-ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        ElevenLabs
                      </a>{" "}
                      e insira o ID aqui.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Start Call Button */}
            <Button
              onClick={handleStartCall}
              className="w-full"
              size="lg"
              disabled={!getElevenLabsAgentId()}
            >
              <Bot className="h-5 w-5 mr-2" />
              Iniciar Chamada com IA
            </Button>
          </div>
        ) : (
          <AICallInterface
            agentId={getElevenLabsAgentId()}
            agentConfig={selectedAgent}
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
