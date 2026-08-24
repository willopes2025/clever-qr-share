import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Copy,
  Trash2,
  ExternalLink,
  Check,
  KeyRound,
  Send,
  Pencil,
} from "lucide-react";
import { useWebhookConfig, WebhookConfig, WEBHOOK_EVENTS } from "@/hooks/useWebhookConfig";
import { WebhookHmacDialog } from "./WebhookHmacDialog";
import { WebhookTestDialog } from "./WebhookTestDialog";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  connection: WebhookConfig;
  hmacSecret: string | null;
}

export function WebhookConnectionCard({ connection, hmacSecret }: Props) {
  const { updateConnection, deleteConnection, regenerateSecret, testWebhook } = useWebhookConfig();
  const [copied, setCopied] = useState(false);
  const [showHmac, setShowHmac] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(connection.name);

  const copyUrl = () => {
    if (!connection.target_url) return;
    navigator.clipboard.writeText(connection.target_url);
    setCopied(true);
    toast.success("URL copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTest = async () => {
    const r = await testWebhook.mutateAsync(connection.id);
    return r as { success: boolean; status?: number; error?: string };
  };

  const handleRename = async () => {
    if (!editName.trim()) return;
    await updateConnection.mutateAsync({ id: connection.id, name: editName.trim() });
    setIsEditing(false);
    toast.success("Webhook renomeado.");
  };

  const eventLabels = (connection.events ?? []).map(
    (e) => WEBHOOK_EVENTS.find((ev) => ev.value === e)?.label ?? e
  );

  return (
    <>
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            {isEditing ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  className="border rounded px-2 py-1 text-sm flex-1"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename();
                    if (e.key === "Escape") setIsEditing(false);
                  }}
                  autoFocus
                />
                <Button size="sm" variant="ghost" onClick={handleRename}>
                  OK
                </Button>
              </div>
            ) : (
              <CardTitle className="text-base font-semibold">
                {connection.name}
              </CardTitle>
            )}
            <Switch
              checked={connection.is_active}
              onCheckedChange={(checked) =>
                updateConnection.mutate({ id: connection.id, is_active: checked })
              }
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge variant={connection.is_active ? "default" : "secondary"}>
              {connection.is_active ? "Ativo" : "Inativo"}
            </Badge>
            <Badge variant="outline">Saida</Badge>
            {eventLabels.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {eventLabels.length} evento(s)
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {connection.target_url && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">URL de destino</p>
              <div className="flex gap-1">
                <code className="text-xs bg-muted/50 px-2 py-1 rounded flex-1 truncate block">
                  {connection.target_url}
                </code>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  onClick={copyUrl}
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
                <a
                  href={connection.target_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </a>
              </div>
            </div>
          )}

          {eventLabels.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Eventos</p>
              <div className="flex flex-wrap gap-1">
                {eventLabels.map((label, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {label}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
            <span>
              Ultimo envio:{" "}
              {connection.last_sent_at
                ? formatDistanceToNow(new Date(connection.last_sent_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })
                : "Nunca"}
            </span>
          </div>

          <div className="flex justify-end gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowTest(true)}
              title="Testar webhook"
            >
              <Send className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowHmac(true)}
              title="Ver HMAC secret"
            >
              <KeyRound className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditName(connection.name);
                setIsEditing(true);
              }}
              title="Renomear"
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => deleteConnection.mutate(connection.id)}
              title="Excluir"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <WebhookHmacDialog
        open={showHmac}
        onOpenChange={setShowHmac}
        hmacSecret={hmacSecret}
        onRegenerate={async () => {
          const r = await regenerateSecret.mutateAsync(connection.id);
          toast.success("Novo HMAC secret gerado!");
          return r;
        }}
        isRegenerating={regenerateSecret.isPending}
      />

      <WebhookTestDialog
        open={showTest}
        onOpenChange={setShowTest}
        webhookName={connection.name}
        onTest={handleTest}
        isLoading={testWebhook.isPending}
      />
    </>
  );
}
