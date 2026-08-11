import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AGENT_ROLES, AGENT_TOOLS } from "@/data/ai-agent-roles";
import { Trash2, Plus, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

interface AgentRoleToolsTabProps {
  agentId: string | null;
  organizationId: string | null;
  roleKey: string | null;
  onRoleKeyChange: (value: string | null) => void;
  objective: string;
  onObjectiveChange: (value: string) => void;
  notAllowed: string;
  onNotAllowedChange: (value: string) => void;
  isOrchestrator: boolean;
  onIsOrchestratorChange: (value: boolean) => void;
  allowedTools: string[];
  onAllowedToolsChange: (value: string[]) => void;
}

export const AgentRoleToolsTab = ({
  agentId,
  organizationId,
  roleKey,
  onRoleKeyChange,
  objective,
  onObjectiveChange,
  notAllowed,
  onNotAllowedChange,
  isOrchestrator,
  onIsOrchestratorChange,
  allowedTools,
  onAllowedToolsChange,
}: AgentRoleToolsTabProps) => {
  const queryClient = useQueryClient();
  const [newTargetId, setNewTargetId] = useState<string>("");
  const [newCondition, setNewCondition] = useState("");

  const { data: peers = [] } = useQuery({
    queryKey: ["agent-peers", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("ai_agent_configs")
        .select("id, agent_name, role_key")
        .eq("organization_id", organizationId)
        .order("agent_name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!organizationId,
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ["agent-transfers", agentId],
    queryFn: async () => {
      if (!agentId) return [];
      const { data, error } = await supabase
        .from("ai_agent_transfers")
        .select("id, to_agent_id, condition_text, is_active")
        .eq("from_agent_id", agentId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!agentId,
  });

  useEffect(() => {
    if (!roleKey || allowedTools.length) return;
    const role = AGENT_ROLES.find((r) => r.key === roleKey);
    if (role) onAllowedToolsChange(role.suggestedTools);
  }, [roleKey]);

  const toggleTool = (key: string) => {
    onAllowedToolsChange(
      allowedTools.includes(key) ? allowedTools.filter((t) => t !== key) : [...allowedTools, key],
    );
  };

  const addTransfer = async () => {
    if (!agentId || !newTargetId) return;
    const { error } = await supabase.from("ai_agent_transfers").insert({
      organization_id: organizationId,
      from_agent_id: agentId,
      to_agent_id: newTargetId,
      condition_text: newCondition.trim() || null,
    });
    if (error) {
      toast.error("Erro ao criar encaminhamento: " + error.message);
      return;
    }
    setNewTargetId("");
    setNewCondition("");
    queryClient.invalidateQueries({ queryKey: ["agent-transfers", agentId] });
    toast.success("Encaminhamento adicionado");
  };

  const removeTransfer = async (id: string) => {
    const { error } = await supabase.from("ai_agent_transfers").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover: " + error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["agent-transfers", agentId] });
  };

  const otherAgents = peers.filter((p: any) => p.id !== agentId);
  const selectedRole = AGENT_ROLES.find((r) => r.key === roleKey);

  return (
    <div className="space-y-6">
      <div>
        <Label>Função na equipe</Label>
        <p className="text-xs text-muted-foreground mb-2">
          O que este colaborador digital faz no dia a dia da empresa.
        </p>
        <Select value={roleKey ?? ""} onValueChange={(v) => onRoleKeyChange(v || null)}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione a função" />
          </SelectTrigger>
          <SelectContent>
            {AGENT_ROLES.map((role) => (
              <SelectItem key={role.key} value={role.key}>
                {role.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedRole && (
          <p className="text-xs text-muted-foreground mt-2">{selectedRole.description}</p>
        )}
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
        <div>
          <Label htmlFor="isOrchestrator">Recepcionista da equipe</Label>
          <p className="text-xs text-muted-foreground">
            Este agente recebe a mensagem primeiro e direciona para o colega certo.
          </p>
        </div>
        <Switch id="isOrchestrator" checked={isOrchestrator} onCheckedChange={onIsOrchestratorChange} />
      </div>

      <div>
        <Label htmlFor="objective">Objetivo</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Qual resultado ele deve entregar em cada atendimento.
        </p>
        <Textarea
          id="objective"
          placeholder="Qualificar o interesse do cliente e agendar uma avaliação."
          value={objective}
          onChange={(e) => onObjectiveChange(e.target.value)}
          className="min-h-[90px]"
        />
      </div>

      <div>
        <Label htmlFor="notAllowed">O que ele não pode fazer</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Limites claros: assuntos proibidos, promessas que não pode assumir.
        </p>
        <Textarea
          id="notAllowed"
          placeholder="Não oferecer descontos. Não falar de prazos de entrega."
          value={notAllowed}
          onChange={(e) => onNotAllowedChange(e.target.value)}
          className="min-h-[80px]"
        />
      </div>

      <div>
        <Label>Permissões</Label>
        <p className="text-xs text-muted-foreground mb-2">
          O que este agente pode consultar e alterar no sistema.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {AGENT_TOOLS.map((tool) => (
            <label
              key={tool.key}
              className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer hover:border-primary/50"
            >
              <Checkbox
                checked={allowedTools.includes(tool.key)}
                onCheckedChange={() => toggleTool(tool.key)}
                className="mt-0.5"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{tool.label}</span>
                  {tool.writes && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      altera dados
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{tool.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label className="flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4" />
          Encaminhar para outro agente
        </Label>
        <p className="text-xs text-muted-foreground mb-2">
          Quando a condição acontecer, o atendimento passa para o colega indicado.
        </p>

        {!agentId ? (
          <p className="text-xs text-muted-foreground">Salve o agente para configurar encaminhamentos.</p>
        ) : (
          <div className="space-y-2">
            {transfers.map((t: any) => {
              const target = peers.find((p: any) => p.id === t.to_agent_id);
              return (
                <Card key={t.id} className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{target?.agent_name ?? "Agente removido"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t.condition_text || "Sem condição definida"}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeTransfer(t.id)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </Card>
              );
            })}

            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={newTargetId} onValueChange={setNewTargetId}>
                <SelectTrigger className="sm:w-56">
                  <SelectValue placeholder="Encaminhar para..." />
                </SelectTrigger>
                <SelectContent>
                  {otherAgents.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.agent_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Quando o cliente perguntar sobre boletos"
                value={newCondition}
                onChange={(e) => setNewCondition(e.target.value)}
              />
              <Button onClick={addTransfer} disabled={!newTargetId} className="gap-1">
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
