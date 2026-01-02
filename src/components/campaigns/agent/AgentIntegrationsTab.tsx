import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Plug, Webhook, Send, Trash2, Settings, ExternalLink, Loader2 } from "lucide-react";
import { useAgentIntegrations, AgentIntegration } from "@/hooks/useAgentIntegrations";
import { ApiIntegrationForm } from "./ApiIntegrationForm";
import { WebhookInCard } from "./WebhookInCard";
import { WebhookOutForm } from "./WebhookOutForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AgentIntegrationsTabProps {
  agentConfigId: string | null;
}

export const AgentIntegrationsTab = ({ agentConfigId }: AgentIntegrationsTabProps) => {
  const { integrations, isLoading, createIntegration, updateIntegration, deleteIntegration, toggleActive } = useAgentIntegrations(agentConfigId);
  
  const [activeSubTab, setActiveSubTab] = useState("api");
  const [isCreatingApi, setIsCreatingApi] = useState(false);
  const [isCreatingWebhookIn, setIsCreatingWebhookIn] = useState(false);
  const [isCreatingWebhookOut, setIsCreatingWebhookOut] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<AgentIntegration | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const apiIntegrations = integrations.filter(i => i.integration_type === 'api');
  const webhookInIntegrations = integrations.filter(i => i.integration_type === 'webhook_in');
  const webhookOutIntegrations = integrations.filter(i => i.integration_type === 'webhook_out');

  const handleCreateApi = () => {
    setEditingIntegration(null);
    setIsCreatingApi(true);
  };

  const handleCreateWebhookIn = async () => {
    if (!agentConfigId) return;
    
    setIsCreatingWebhookIn(true);
    try {
      await createIntegration.mutateAsync({
        agent_config_id: agentConfigId,
        integration_type: 'webhook_in',
        name: `Webhook de Entrada ${webhookInIntegrations.length + 1}`,
      });
    } finally {
      setIsCreatingWebhookIn(false);
    }
  };

  const handleCreateWebhookOut = () => {
    setEditingIntegration(null);
    setIsCreatingWebhookOut(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    await deleteIntegration.mutateAsync(deletingId);
    setDeletingId(null);
  };

  if (!agentConfigId) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Salve o agente primeiro para configurar integrações.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="api" className="gap-1">
            <Plug className="h-4 w-4" />
            <span className="hidden sm:inline">API</span>
            {apiIntegrations.length > 0 && (
              <Badge variant="secondary" className="ml-1">{apiIntegrations.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="webhook_in" className="gap-1">
            <Webhook className="h-4 w-4" />
            <span className="hidden sm:inline">Receber</span>
            {webhookInIntegrations.length > 0 && (
              <Badge variant="secondary" className="ml-1">{webhookInIntegrations.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="webhook_out" className="gap-1">
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Enviar</span>
            {webhookOutIntegrations.length > 0 && (
              <Badge variant="secondary" className="ml-1">{webhookOutIntegrations.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* API Integrations */}
        <TabsContent value="api" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-medium">Integrações via API</h4>
              <p className="text-sm text-muted-foreground">Conecte a qualquer plataforma externa via API</p>
            </div>
            <Button onClick={handleCreateApi} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Adicionar API
            </Button>
          </div>

          {apiIntegrations.length === 0 && !isCreatingApi ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Plug className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhuma integração via API configurada</p>
                <Button variant="outline" className="mt-4" onClick={handleCreateApi}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar primeira API
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {apiIntegrations.map((integration) => (
                <Card key={integration.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{integration.name}</CardTitle>
                        <Badge variant={integration.is_active ? "default" : "secondary"}>
                          {integration.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={integration.is_active}
                          onCheckedChange={(checked) => toggleActive.mutate({ id: integration.id, is_active: checked })}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingIntegration(integration);
                            setIsCreatingApi(true);
                          }}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingId(integration.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {integration.description && (
                      <CardDescription>{integration.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="pb-3">
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <ExternalLink className="h-3 w-3" />
                      {integration.api_base_url || "URL não configurada"}
                    </div>
                    {integration.last_error && (
                      <p className="text-sm text-destructive mt-2">Último erro: {integration.last_error}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {isCreatingApi && (
            <ApiIntegrationForm
              agentConfigId={agentConfigId}
              integration={editingIntegration}
              onClose={() => {
                setIsCreatingApi(false);
                setEditingIntegration(null);
              }}
              onSave={async (data) => {
                if (editingIntegration) {
                  await updateIntegration.mutateAsync({ id: editingIntegration.id, ...data });
                } else {
                  await createIntegration.mutateAsync({
                    agent_config_id: agentConfigId,
                    integration_type: 'api',
                    ...data,
                  });
                }
                setIsCreatingApi(false);
                setEditingIntegration(null);
              }}
            />
          )}
        </TabsContent>

        {/* Incoming Webhooks */}
        <TabsContent value="webhook_in" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-medium">Webhooks de Entrada</h4>
              <p className="text-sm text-muted-foreground">Receba dados de plataformas externas (Calendly, CRMs, etc)</p>
            </div>
            <Button onClick={handleCreateWebhookIn} size="sm" disabled={isCreatingWebhookIn}>
              {isCreatingWebhookIn ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              Criar Webhook
            </Button>
          </div>

          {webhookInIntegrations.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Webhook className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhum webhook de entrada configurado</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Use webhooks para receber notificações de agendamentos, leads, etc.
                </p>
                <Button variant="outline" className="mt-4" onClick={handleCreateWebhookIn} disabled={isCreatingWebhookIn}>
                  {isCreatingWebhookIn ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-1" />
                  )}
                  Criar primeiro webhook
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {webhookInIntegrations.map((integration) => (
                <WebhookInCard
                  key={integration.id}
                  integration={integration}
                  onToggle={(checked) => toggleActive.mutate({ id: integration.id, is_active: checked })}
                  onDelete={() => setDeletingId(integration.id)}
                  onUpdate={async (data) => { await updateIntegration.mutateAsync({ id: integration.id, ...data }); }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Outgoing Webhooks */}
        <TabsContent value="webhook_out" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-medium">Webhooks de Saída</h4>
              <p className="text-sm text-muted-foreground">Envie dados para sistemas externos quando eventos ocorrerem</p>
            </div>
            <Button onClick={handleCreateWebhookOut} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Adicionar Webhook
            </Button>
          </div>

          {webhookOutIntegrations.length === 0 && !isCreatingWebhookOut ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Send className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhum webhook de saída configurado</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure webhooks para notificar sistemas externos sobre eventos do agente
                </p>
                <Button variant="outline" className="mt-4" onClick={handleCreateWebhookOut}>
                  <Plus className="h-4 w-4 mr-1" />
                  Criar primeiro webhook
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {webhookOutIntegrations.map((integration) => (
                <Card key={integration.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{integration.name}</CardTitle>
                        <Badge variant={integration.is_active ? "default" : "secondary"}>
                          {integration.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={integration.is_active}
                          onCheckedChange={(checked) => toggleActive.mutate({ id: integration.id, is_active: checked })}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingIntegration(integration);
                            setIsCreatingWebhookOut(true);
                          }}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingId(integration.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <ExternalLink className="h-3 w-3" />
                      {integration.webhook_target_url || "URL não configurada"}
                    </div>
                    {integration.webhook_events && integration.webhook_events.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {integration.webhook_events.map((event) => (
                          <Badge key={event} variant="outline" className="text-xs">{event}</Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {isCreatingWebhookOut && (
            <WebhookOutForm
              agentConfigId={agentConfigId}
              integration={editingIntegration}
              onClose={() => {
                setIsCreatingWebhookOut(false);
                setEditingIntegration(null);
              }}
              onSave={async (data) => {
                if (editingIntegration) {
                  await updateIntegration.mutateAsync({ id: editingIntegration.id, ...data });
                } else {
                  await createIntegration.mutateAsync({
                    agent_config_id: agentConfigId,
                    integration_type: 'webhook_out',
                    ...data,
                  });
                }
                setIsCreatingWebhookOut(false);
                setEditingIntegration(null);
              }}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover integração?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A integração será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
