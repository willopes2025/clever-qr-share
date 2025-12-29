import { useState, useEffect } from "react";
import { Bot, Settings, User, Sparkles, Phone, PhoneCall, Headphones } from "lucide-react";
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
import { RealCallPanel } from "./RealCallPanel";
import { toast } from "sonner";
import { useAllAgentConfigs, AIAgentConfig } from "@/hooks/useAIAgentConfig";
import { useElevenLabsSIP } from "@/hooks/useElevenLabsSIP";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const [callMode, setCallMode] = useState<"simulation" | "real">("simulation");
  const [activeCallId, setActiveCallId] = useState<string | null>(null);

  const { data: agents, isLoading: agentsLoading } = useAllAgentConfigs();
  const { activeSIPConfig, isSIPConfigured, initiateCall } = useElevenLabsSIP();

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

  const handleStartSimulation = () => {
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
    
    setCallMode("simulation");
    setIsCallActive(true);
  };

  const handleStartRealCall = async () => {
    if (!isSIPConfigured) {
      toast.error("Configure o SIP Trunk primeiro em Configurações > Integrações");
      return;
    }

    if (!selectedAgentId || !selectedAgent) {
      toast.error("Selecione um agente configurado para chamadas reais");
      return;
    }

    if (!selectedAgent.elevenlabs_agent_id) {
      toast.error("Este agente não possui Agent ID do ElevenLabs configurado");
      return;
    }

    try {
      const result = await initiateCall.mutateAsync({
        contactPhone,
        contactId,
        conversationId,
        agentConfigId: selectedAgentId,
        sipConfigId: activeSIPConfig!.id,
      });

      setActiveCallId(result.call_id);
      setCallMode("real");
      setIsCallActive(true);
    } catch (error) {
      console.error("Erro ao iniciar chamada real:", error);
    }
  };

  const handleEndCall = async () => {
    setIsCallActive(false);
    setActiveCallId(null);
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
      <DialogContent className="max-w-lg">
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

            <Separator />

            {/* Call Mode Selection */}
            <div className="space-y-3">
              <Label>Modo de Chamada</Label>
              
              <Tabs defaultValue="simulation" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="simulation" className="flex items-center gap-2">
                    <Headphones className="h-4 w-4" />
                    Simulação
                  </TabsTrigger>
                  <TabsTrigger value="real" className="flex items-center gap-2" disabled={!isSIPConfigured}>
                    <PhoneCall className="h-4 w-4" />
                    Chamada Real
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="simulation" className="space-y-3">
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-sm text-muted-foreground">
                      <strong>Simulação:</strong> Converse com a IA pelo seu navegador usando seu microfone. 
                      Ideal para testar o agente antes de fazer chamadas reais.
                    </p>
                  </div>
                  
                  <Button
                    onClick={handleStartSimulation}
                    className="w-full"
                    size="lg"
                    disabled={!getElevenLabsAgentId()}
                  >
                    <Headphones className="h-5 w-5 mr-2" />
                    Iniciar Simulação
                  </Button>
                </TabsContent>

                <TabsContent value="real" className="space-y-3">
                  {isSIPConfigured ? (
                    <>
                      <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3">
                        <div className="flex items-center gap-2 text-emerald-600">
                          <Phone className="h-4 w-4" />
                          <span className="text-sm font-medium">SIP Trunk Configurado</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Número: {activeSIPConfig?.phone_number}
                        </p>
                      </div>
                      
                      <div className="rounded-lg bg-muted/30 p-3">
                        <p className="text-sm text-muted-foreground">
                          <strong>Chamada Real:</strong> A IA irá ligar diretamente para o telefone do contato 
                          ({contactPhone}) e conduzir a conversa automaticamente.
                        </p>
                      </div>

                      <Button
                        onClick={handleStartRealCall}
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                        size="lg"
                        disabled={!selectedAgentId || !selectedAgent?.elevenlabs_agent_id || initiateCall.isPending}
                      >
                        <PhoneCall className="h-5 w-5 mr-2" />
                        {initiateCall.isPending ? "Iniciando..." : "Ligar com IA"}
                      </Button>
                    </>
                  ) : (
                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-4 text-center">
                      <Phone className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                      <p className="text-sm font-medium text-amber-600">SIP Trunk não configurado</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Configure a integração do Vono com ElevenLabs em{" "}
                        <span className="text-primary">Configurações → Integrações</span>
                      </p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        ) : callMode === "simulation" ? (
          <AICallInterface
            agentId={getElevenLabsAgentId()}
            agentConfig={selectedAgent}
            contactName={contactName}
            contactPhone={contactPhone}
            onTranscriptUpdate={handleTranscriptUpdate}
            onEnd={handleEndCall}
          />
        ) : (
          <RealCallPanel
            callId={activeCallId}
            contactName={contactName}
            contactPhone={contactPhone}
            onEnd={handleEndCall}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
