import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Copy, Trash2, ExternalLink, Check } from "lucide-react";
import { useWebhookConnections, WebhookConnection } from "@/hooks/useWebhookConnections";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  connection: WebhookConnection;
}

export function WebhookConnectionCard({ connection }: Props) {
  const { updateConnection, deleteConnection } = useWebhookConnections();
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/make-webhook?token=${connection.webhook_token}`;

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success("URL copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  const directionLabel: Record<string, string> = {
    both: "Bidirecional",
    in: "Entrada",
    out: "Saída",
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">{connection.name}</CardTitle>
          <Switch
            checked={connection.is_active}
            onCheckedChange={checked => updateConnection.mutate({ id: connection.id, is_active: checked })}
          />
        </div>
        <div className="flex gap-2">
          <Badge variant={connection.is_active ? "default" : "secondary"}>
            {connection.is_active ? "Ativo" : "Inativo"}
          </Badge>
          <Badge variant="outline">{directionLabel[connection.direction] || connection.direction}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground mb-1">URL do Webhook</p>
          <div className="flex gap-1">
            <code className="text-xs bg-muted/50 px-2 py-1 rounded flex-1 truncate block">{webhookUrl}</code>
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={copyUrl}>
              {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        </div>

        {connection.target_url && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">URL de destino</p>
            <div className="flex items-center gap-1">
              <code className="text-xs bg-muted/50 px-2 py-1 rounded flex-1 truncate block">{connection.target_url}</code>
              <a href={connection.target_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </a>
            </div>
          </div>
        )}

        <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
          <span>
            Último recebido: {connection.last_received_at
              ? formatDistanceToNow(new Date(connection.last_received_at), { addSuffix: true, locale: ptBR })
              : "Nunca"}
          </span>
        </div>

        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => deleteConnection.mutate(connection.id)}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Excluir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
