import { useState } from "react";
import { AppLayout } from "@/layouts/AppLayout";
import { useWebhookConnections, useWebhookLogs } from "@/hooks/useWebhookConnections";
import { WebhookConnectionCard } from "@/components/webhooks/WebhookConnectionCard";
import { WebhookLogsTable } from "@/components/webhooks/WebhookLogsTable";
import { WebhookDocsPanel } from "@/components/webhooks/WebhookDocsPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Webhook, ScrollText, BookOpen } from "lucide-react";

const Webhooks = () => {
  const { connections, isLoading, createConnection } = useWebhookConnections();
  const { data: logs = [] } = useWebhookLogs();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [direction, setDirection] = useState("both");
  const [targetUrl, setTargetUrl] = useState("");

  const handleCreate = () => {
    if (!name.trim()) return;
    createConnection.mutate(
      { name: name.trim(), direction, target_url: targetUrl || undefined },
      { onSuccess: () => { setOpen(false); setName(""); setTargetUrl(""); } }
    );
  };

  return (
    <AppLayout pageTitle="Webhooks" className="p-4 md:p-8 animated-gradient cyber-grid relative">
      <div className="fixed top-20 right-1/4 w-64 h-64 bg-neon-cyan/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="mb-8 relative z-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2 text-foreground flex items-center gap-3">
            <Webhook className="h-8 w-8 text-primary" />
            Webhooks
          </h1>
          <p className="text-muted-foreground">
            Conecte o Make, Zapier ou qualquer automação externa via webhooks bidirecionais
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Webhook
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Webhook</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Nome</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Make - Leads" />
              </div>
              <div>
                <Label>Direção</Label>
                <Select value={direction} onValueChange={setDirection}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Bidirecional</SelectItem>
                    <SelectItem value="in">Somente Entrada</SelectItem>
                    <SelectItem value="out">Somente Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(direction === "out" || direction === "both") && (
                <div>
                  <Label>URL de destino (para envio)</Label>
                  <Input value={targetUrl} onChange={e => setTargetUrl(e.target.value)} placeholder="https://hook.make.com/..." />
                </div>
              )}
              <Button onClick={handleCreate} disabled={!name.trim() || createConnection.isPending} className="w-full">
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
            Conexões
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <ScrollText className="h-4 w-4" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="docs" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Documentação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connections">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : connections.length === 0 ? (
            <div className="text-center py-12">
              <Webhook className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum webhook criado ainda</p>
              <p className="text-sm text-muted-foreground mt-1">Crie um webhook para começar a integrar com o Make</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {connections.map(conn => (
                <WebhookConnectionCard key={conn.id} connection={conn} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs">
          <WebhookLogsTable logs={logs} />
        </TabsContent>

        <TabsContent value="docs">
          <WebhookDocsPanel />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default Webhooks;
