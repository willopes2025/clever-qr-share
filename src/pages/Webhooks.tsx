import { useState } from "react";
import { AppLayout } from "@/layouts/AppLayout";
import {
  useWebhookConfig,
  useWebhookLogs,
} from "@/hooks/useWebhookConfig";
import { WebhookConnectionCard } from "@/components/webhooks/WebhookConnectionCard";
import { WebhookEventSelector } from "@/components/webhooks/WebhookEventSelector";
import { WebhookLogsTable } from "@/components/webhooks/WebhookLogsTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Webhook, ScrollText, KeyRound } from "lucide-react";
import { toast } from "sonner";

const Webhooks = () => {
  const {
    connections,
    isLoading,
    createConnection,
    regenerateSecret,
  } = useWebhookConfig();
  const { data: logs = [] } = useWebhookLogs();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [hmacSecrets, setHmacSecrets] = useState<Record<string, string>>({});

  const handleCreate = async () => {
    if (!name.trim() || !targetUrl.trim()) return;
    try {
      const result = await createConnection.mutateAsync({
        name: name.trim(),
        target_url: targetUrl.trim(),
        events,
      });
      if (result.hmac_secret) {
        setHmacSecrets((prev) => ({ ...prev, [result.id]: result.hmac_secret }));
      }
      setOpen(false);
      setName("");
      setTargetUrl("");
      setEvents([]);
      toast.success("Webhook criado! Guarde o HMAC secret.");
    } catch {
      toast.error("Erro ao criar webhook.");
    }
  };

  return (
    <AppLayout
      pageTitle="Webhooks"
      className="p-4 md:p-8 animated-gradient cyber-grid relative"
    >
      <div className="fixed top-20 right-1/4 w-64 h-64 bg-neon-cyan/5 rounded-full blur-3xl pointer-events-none" />

      <div className="mb-8 relative z-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2 text-foreground flex items-center gap-3">
            <Webhook className="h-8 w-8 text-primary" />
            Webhooks
          </h1>
          <p className="text-muted-foreground">
            Receba notificacoes em tempo real quando eventos ocorrerem no
            WideZap
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Criar Webhook</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Nome</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Notificacao ERP"
                />
              </div>
              <div>
                <Label>URL de destino</Label>
                <Input
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://sua-api.com/webhook"
                />
              </div>
              <div>
                <Label>Eventos</Label>
                <WebhookEventSelector
                  selected={events}
                  onChange={setEvents}
                />
              </div>
              <Button
                onClick={handleCreate}
                disabled={
                  !name.trim() || !targetUrl.trim() || createConnection.isPending
                }
                className="w-full"
              >
                {createConnection.isPending ? "Criando..." : "Criar Webhook"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="connections" className="space-y-6 relative z-10">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="connections" className="gap-2">
            <Webhook className="h-4 w-4" />
            Conexoes
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <ScrollText className="h-4 w-4" />
            Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connections">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Carregando...
            </div>
          ) : connections.length === 0 ? (
            <div className="text-center py-12">
              <Webhook className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                Nenhum webhook criado ainda
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Crie um webhook para receber notificacoes de eventos
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {connections.map((conn) => (
                <WebhookConnectionCard
                  key={conn.id}
                  connection={conn}
                  hmacSecret={hmacSecrets[conn.id] ?? null}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs">
          <WebhookLogsTable logs={logs} />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default Webhooks;
