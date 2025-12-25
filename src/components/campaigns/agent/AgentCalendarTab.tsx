import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, Link, Check, X, ExternalLink, RefreshCw, CheckCircle2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface AgentCalendarTabProps {
  agentConfigId: string | null;
}

interface CalendlyEventType {
  uri: string;
  name: string;
  duration: number;
  scheduling_url: string;
  active: boolean;
}

export function AgentCalendarTab({ agentConfigId }: AgentCalendarTabProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [apiToken, setApiToken] = useState("");

  // Fetch integration for this agent
  const { data: integration, isLoading: isLoadingIntegration } = useQuery({
    queryKey: ["agent-calendar-integration", agentConfigId],
    queryFn: async () => {
      if (!agentConfigId) return null;

      const { data, error } = await supabase
        .from("calendar_integrations")
        .select("*")
        .eq("agent_config_id", agentConfigId)
        .eq("provider", "calendly")
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!agentConfigId,
  });

  // Fetch event types
  const { data: eventTypes, isLoading: isLoadingEventTypes, refetch: refetchEventTypes } = useQuery({
    queryKey: ["agent-calendly-event-types", agentConfigId],
    queryFn: async () => {
      if (!integration) return [];

      const { data, error } = await supabase.functions.invoke("calendly-integration", {
        body: { 
          action: "list-event-types", 
          agentConfigId,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data.eventTypes as CalendlyEventType[];
    },
    enabled: !!integration?.is_active,
  });

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: async (token: string) => {
      if (!user?.id || !agentConfigId) throw new Error("Dados incompletos");

      const { data, error } = await supabase.functions.invoke("calendly-integration", {
        body: { 
          action: "setup", 
          userId: user.id, 
          agentConfigId,
          apiToken: token,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Erro ao conectar");
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-calendar-integration", agentConfigId] });
      toast({
        title: "Calendly conectado!",
        description: "O agente de IA agora pode acessar sua agenda.",
      });
      setApiToken("");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao conectar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Select event type mutation
  const selectEventTypeMutation = useMutation({
    mutationFn: async (eventType: CalendlyEventType) => {
      if (!agentConfigId) throw new Error("Agent config não encontrado");

      const { data, error } = await supabase.functions.invoke("calendly-integration", {
        body: { 
          action: "select-event-type", 
          agentConfigId,
          eventTypeUri: eventType.uri,
          eventTypeName: eventType.name,
          schedulingUrl: eventType.scheduling_url,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-calendar-integration", agentConfigId] });
      toast({
        title: "Tipo de evento selecionado!",
        description: "A IA usará este link para agendamentos.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao selecionar evento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Register webhook mutation
  const webhookMutation = useMutation({
    mutationFn: async () => {
      if (!agentConfigId) throw new Error("Agent config não encontrado");

      const { data, error } = await supabase.functions.invoke("calendly-integration", {
        body: { 
          action: "register-webhook", 
          agentConfigId,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-calendar-integration", agentConfigId] });
      toast({
        title: "Webhook registrado!",
        description: "Novos agendamentos serão sincronizados automaticamente.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao registrar webhook",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!agentConfigId) throw new Error("Agent config não encontrado");

      const { data, error } = await supabase.functions.invoke("calendly-integration", {
        body: { 
          action: "disconnect", 
          agentConfigId,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-calendar-integration", agentConfigId] });
      queryClient.invalidateQueries({ queryKey: ["agent-calendly-event-types", agentConfigId] });
      toast({
        title: "Calendly desconectado",
        description: "A integração foi removida.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao desconectar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleConnect = async () => {
    if (!apiToken.trim()) {
      toast({
        title: "Token obrigatório",
        description: "Por favor, insira seu API Token do Calendly.",
        variant: "destructive",
      });
      return;
    }
    connectMutation.mutate(apiToken);
  };

  if (!agentConfigId) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">
          Salve a campanha primeiro para configurar a integração com calendário.
        </p>
      </div>
    );
  }

  if (isLoadingIntegration) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const isConnected = !!integration?.is_active;
  const selectedEventTypeUri = (integration as { selected_event_type_uri?: string })?.selected_event_type_uri;

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Calendly</CardTitle>
            </div>
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? (
                <><Check className="h-3 w-3 mr-1" /> Conectado</>
              ) : (
                <><X className="h-3 w-3 mr-1" /> Desconectado</>
              )}
            </Badge>
          </div>
          <CardDescription>
            Conecte o Calendly para que a IA possa informar sua disponibilidade e gerar links de agendamento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isConnected ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-token">API Token do Calendly</Label>
                <Input
                  id="api-token"
                  type="password"
                  placeholder="Insira seu Personal Access Token"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Obtenha seu token em{" "}
                  <a
                    href="https://calendly.com/integrations/api_webhooks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    calendly.com/integrations
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>
              <Button 
                onClick={handleConnect}
                disabled={connectMutation.isPending || !apiToken.trim()}
                className="w-full"
              >
                {connectMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Conectando...</>
                ) : (
                  <><Link className="h-4 w-4 mr-2" /> Conectar Calendly</>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Event Types */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Selecione o Tipo de Evento para Agendamentos</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => refetchEventTypes()}
                    disabled={isLoadingEventTypes}
                  >
                    <RefreshCw className={`h-3 w-3 ${isLoadingEventTypes ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                
                {isLoadingEventTypes ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando tipos de eventos...
                  </div>
                ) : eventTypes && eventTypes.length > 0 ? (
                  <div className="space-y-2">
                    {eventTypes.map((et) => {
                      const isSelected = selectedEventTypeUri === et.uri;
                      return (
                        <div
                          key={et.uri}
                          className={`flex items-center justify-between p-3 rounded-md border transition-colors ${
                            isSelected 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border bg-muted/50 hover:bg-muted'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {isSelected && (
                              <CheckCircle2 className="h-5 w-5 text-primary" />
                            )}
                            <div>
                              <p className="text-sm font-medium">{et.name}</p>
                              <p className="text-xs text-muted-foreground">{et.duration} min</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={et.scheduling_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            <Button
                              variant={isSelected ? "secondary" : "outline"}
                              size="sm"
                              onClick={() => selectEventTypeMutation.mutate(et)}
                              disabled={selectEventTypeMutation.isPending || isSelected}
                            >
                              {selectEventTypeMutation.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : isSelected ? (
                                "Selecionado"
                              ) : (
                                "Selecionar"
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum tipo de evento encontrado
                  </p>
                )}

                {!selectedEventTypeUri && eventTypes && eventTypes.length > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    ⚠️ Selecione um tipo de evento para que a IA possa agendar consultas.
                  </p>
                )}
              </div>

              {/* Webhook Status */}
              <div className="space-y-2">
                <Label>Notificações Automáticas</Label>
                {integration?.webhook_subscription_id ? (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-green-500/10 text-green-700 dark:text-green-400">
                    <Check className="h-4 w-4" />
                    <span className="text-sm">Webhook ativo - novos agendamentos serão sincronizados</span>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => webhookMutation.mutate()}
                    disabled={webhookMutation.isPending}
                    className="w-full"
                  >
                    {webhookMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Registrando...</>
                    ) : (
                      "Ativar notificações de agendamento"
                    )}
                  </Button>
                )}
              </div>

              {/* How it works */}
              <div className="p-3 rounded-md bg-muted/50 space-y-2">
                <p className="text-sm font-medium">Como a IA usa o calendário:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Quando o cliente perguntar sobre horários, a IA consultará sua agenda</li>
                  <li>• A IA vai usar o link do evento selecionado acima</li>
                  <li>• Novos agendamentos são salvos automaticamente</li>
                </ul>
              </div>

              {/* Disconnect Button */}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                className="w-full"
              >
                {disconnectMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Desconectando...</>
                ) : (
                  "Desconectar Calendly"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
