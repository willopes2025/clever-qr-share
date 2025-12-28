import { Node } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Settings } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NodeData {
  message?: string;
  delay?: number;
  question?: string;
  variable?: string;
  operator?: string;
  value?: string;
  duration?: number;
  unit?: string;
  prompt?: string;
  maxTokens?: number;
  actionType?: string;
  config?: {
    tagName?: string;
    varName?: string;
    varValue?: string;
  };
}

interface ChatbotNodeConfigProps {
  node: Node;
  onClose: () => void;
  onUpdate: (nodeId: string, data: Record<string, any>) => void;
}

export const ChatbotNodeConfig = ({ node, onClose, onUpdate }: ChatbotNodeConfigProps) => {
  const data = node.data as NodeData;
  const handleChange = (key: string, value: any) => {
    onUpdate(node.id, { [key]: value });
  };

  const renderConfig = () => {
    switch (node.type) {
      case "start":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Este é o ponto de entrada do fluxo. Quando uma mensagem é recebida, o fluxo inicia aqui.
            </p>
          </div>
        );

      case "message":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="message">Mensagem</Label>
              <Textarea
                id="message"
                value={data?.message || ""}
                onChange={(e) => handleChange("message", e.target.value)}
                placeholder="Digite a mensagem a ser enviada..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Use {"{{variavel}}"} para inserir variáveis dinâmicas
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="delay">Delay (segundos)</Label>
              <Input
                id="delay"
                type="number"
                min={0}
                value={data?.delay || 0}
                onChange={(e) => handleChange("delay", parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
        );

      case "question":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="question">Pergunta</Label>
              <Textarea
                id="question"
                value={data?.question || ""}
                onChange={(e) => handleChange("question", e.target.value)}
                placeholder="Digite a pergunta..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="variable">Salvar resposta em</Label>
              <Input
                id="variable"
                value={data?.variable || ""}
                onChange={(e) => handleChange("variable", e.target.value)}
                placeholder="nome_variavel"
              />
            </div>
          </div>
        );

      case "condition":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="variable">Variável</Label>
              <Input
                id="variable"
                value={data?.variable || ""}
                onChange={(e) => handleChange("variable", e.target.value)}
                placeholder="nome_variavel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="operator">Operador</Label>
              <Select
                value={data?.operator || "equals"}
                onValueChange={(v) => handleChange("operator", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">Igual a</SelectItem>
                  <SelectItem value="not_equals">Diferente de</SelectItem>
                  <SelectItem value="contains">Contém</SelectItem>
                  <SelectItem value="not_contains">Não contém</SelectItem>
                  <SelectItem value="starts_with">Começa com</SelectItem>
                  <SelectItem value="ends_with">Termina com</SelectItem>
                  <SelectItem value="greater_than">Maior que</SelectItem>
                  <SelectItem value="less_than">Menor que</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="value">Valor</Label>
              <Input
                id="value"
                value={data?.value || ""}
                onChange={(e) => handleChange("value", e.target.value)}
                placeholder="valor para comparar"
              />
            </div>
          </div>
        );

      case "delay":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Duração</Label>
              <Input
                id="duration"
                type="number"
                min={1}
                value={data?.duration || 5}
                onChange={(e) => handleChange("duration", parseInt(e.target.value) || 5)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unidade</Label>
              <Select
                value={data?.unit || "seconds"}
                onValueChange={(v) => handleChange("unit", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seconds">Segundos</SelectItem>
                  <SelectItem value="minutes">Minutos</SelectItem>
                  <SelectItem value="hours">Horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case "ai_response":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt">Prompt do Sistema</Label>
              <Textarea
                id="prompt"
                value={data?.prompt || ""}
                onChange={(e) => handleChange("prompt", e.target.value)}
                placeholder="Você é um assistente útil..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxTokens">Máximo de Tokens</Label>
              <Input
                id="maxTokens"
                type="number"
                min={50}
                max={4000}
                value={data?.maxTokens || 500}
                onChange={(e) => handleChange("maxTokens", parseInt(e.target.value) || 500)}
              />
            </div>
          </div>
        );

      case "action":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="actionType">Tipo de Ação</Label>
              <Select
                value={data?.actionType || "add_tag"}
                onValueChange={(v) => handleChange("actionType", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add_tag">Adicionar Tag</SelectItem>
                  <SelectItem value="remove_tag">Remover Tag</SelectItem>
                  <SelectItem value="move_funnel">Mover no Funil</SelectItem>
                  <SelectItem value="set_variable">Definir Variável</SelectItem>
                  <SelectItem value="transfer">Transferir para Humano</SelectItem>
                  <SelectItem value="http_request">Requisição HTTP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {renderActionConfig()}
          </div>
        );

      case "end":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Este é o ponto de finalização do fluxo. A conversa será encerrada aqui.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  const renderActionConfig = () => {
    const actionType = data?.actionType || "add_tag";
    const config = data?.config || {};
    
    switch (actionType) {
      case "add_tag":
      case "remove_tag":
        return (
          <div className="space-y-2">
            <Label htmlFor="tagName">Nome da Tag</Label>
            <Input
              id="tagName"
              value={config.tagName || ""}
              onChange={(e) => handleChange("config", { ...config, tagName: e.target.value })}
              placeholder="nome-da-tag"
            />
          </div>
        );
      case "set_variable":
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="varName">Nome da Variável</Label>
              <Input
                id="varName"
                value={config.varName || ""}
                onChange={(e) => handleChange("config", { ...config, varName: e.target.value })}
                placeholder="nome_variavel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="varValue">Valor</Label>
              <Input
                id="varValue"
                value={config.varValue || ""}
                onChange={(e) => handleChange("config", { ...config, varValue: e.target.value })}
                placeholder="valor"
              />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  const getNodeTypeName = () => {
    const typeNames: Record<string, string> = {
      start: "Início",
      message: "Mensagem",
      question: "Pergunta",
      condition: "Condição",
      delay: "Aguardar",
      ai_response: "Resposta IA",
      action: "Ação",
      end: "Fim",
    };
    return typeNames[node.type || ""] || "Nó";
  };

  return (
    <aside className="w-80 border-l border-border bg-card flex flex-col">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">{getNodeTypeName()}</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4">
          {renderConfig()}
        </div>
      </ScrollArea>
    </aside>
  );
};
