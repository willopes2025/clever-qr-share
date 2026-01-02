import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, Trash2, ChevronDown, ChevronUp, RefreshCw, ExternalLink } from "lucide-react";
import { AgentIntegration, useWebhookLogs } from "@/hooks/useAgentIntegrations";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface WebhookInCardProps {
  integration: AgentIntegration;
  onToggle: (checked: boolean) => void;
  onDelete: () => void;
  onUpdate: (data: Partial<AgentIntegration>) => Promise<void>;
}

export const WebhookInCard = ({ integration, onToggle, onDelete, onUpdate }: WebhookInCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState(integration.name);
  const [isEditingName, setIsEditingName] = useState(false);

  const { data: logs, refetch: refetchLogs } = useWebhookLogs(isExpanded ? integration.id : null);

  const handleCopyUrl = async () => {
    if (integration.webhook_url) {
      await navigator.clipboard.writeText(integration.webhook_url);
      setCopied(true);
      toast.success("URL copiada!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveName = async () => {
    if (name.trim() && name !== integration.name) {
      await onUpdate({ name: name.trim() });
    }
    setIsEditingName(false);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isEditingName ? (
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                className="h-7 w-48"
                autoFocus
              />
            ) : (
              <CardTitle
                className="text-base cursor-pointer hover:text-primary"
                onClick={() => setIsEditingName(true)}
              >
                {integration.name}
              </CardTitle>
            )}
            <Badge variant={integration.is_active ? "default" : "secondary"}>
              {integration.is_active ? "Ativo" : "Inativo"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={integration.is_active}
              onCheckedChange={onToggle}
            />
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Webhook URL */}
        <div>
          <Label className="text-xs text-muted-foreground">URL do Webhook</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input
              value={integration.webhook_url || ""}
              readOnly
              className="font-mono text-xs bg-muted"
            />
            <Button variant="outline" size="icon" onClick={handleCopyUrl}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Security Token */}
        <div>
          <Label className="text-xs text-muted-foreground">Token de Segurança</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input
              value={integration.webhook_token || ""}
              type="password"
              readOnly
              className="font-mono text-xs bg-muted"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            O token é enviado como parâmetro na URL para validação
          </p>
        </div>

        {/* Usage instructions */}
        <div className="bg-muted/50 rounded-md p-3 text-sm">
          <p className="font-medium mb-2">Como usar:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
            <li>Copie a URL do webhook acima</li>
            <li>Configure no sistema externo (Calendly, CRM, etc)</li>
            <li>O sistema enviará dados via POST para esta URL</li>
            <li>Os dados recebidos ficarão disponíveis para o agente</li>
          </ol>
        </div>

        {/* Expand/Collapse logs */}
        <Button
          variant="ghost"
          className="w-full justify-between"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span>Ver logs recentes</span>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>

        {/* Logs section */}
        {isExpanded && (
          <div className="border rounded-md">
            <div className="flex items-center justify-between p-2 border-b bg-muted/30">
              <span className="text-sm font-medium">Últimas chamadas</span>
              <Button variant="ghost" size="sm" onClick={() => refetchLogs()}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Atualizar
              </Button>
            </div>
            <ScrollArea className="h-48">
              {logs && logs.length > 0 ? (
                <div className="divide-y">
                  {logs.map((log) => (
                    <div key={log.id} className="p-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                        </span>
                        <Badge variant={log.error_message ? "destructive" : "outline"} className="text-xs">
                          {log.event_type || "evento"}
                        </Badge>
                      </div>
                      {log.payload && (
                        <pre className="mt-1 p-1 bg-muted rounded text-[10px] overflow-x-auto">
                          {JSON.stringify(log.payload, null, 2).slice(0, 200)}
                          {JSON.stringify(log.payload, null, 2).length > 200 && "..."}
                        </pre>
                      )}
                      {log.error_message && (
                        <p className="text-destructive mt-1">{log.error_message}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <ExternalLink className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma chamada recebida ainda</p>
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        {/* Last used info */}
        {integration.last_used_at && (
          <p className="text-xs text-muted-foreground">
            Último uso: {format(new Date(integration.last_used_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
