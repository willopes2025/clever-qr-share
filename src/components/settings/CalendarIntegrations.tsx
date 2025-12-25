import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Calendar, 
  Link2, 
  Unlink, 
  Loader2, 
  CheckCircle2, 
  ExternalLink,
  Bell,
  Clock,
  User,
  Mail,
  Phone
} from "lucide-react";
import { useCalendarIntegrations } from "@/hooks/useCalendarIntegrations";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const CalendarIntegrations = () => {
  const [apiToken, setApiToken] = useState("");
  const [showTokenInput, setShowTokenInput] = useState(false);
  
  const {
    integration,
    isLoadingIntegration,
    events,
    isLoadingEvents,
    isConnected,
    connectCalendly,
    registerWebhook,
    disconnectCalendly,
  } = useCalendarIntegrations();

  const handleConnect = async () => {
    if (!apiToken.trim()) return;
    
    await connectCalendly.mutateAsync(apiToken);
    setApiToken("");
    setShowTokenInput(false);
  };

  const handleRegisterWebhook = async () => {
    await registerWebhook.mutateAsync();
  };

  const handleDisconnect = async () => {
    if (confirm("Tem certeza que deseja desconectar sua conta do Calendly?")) {
      await disconnectCalendly.mutateAsync();
    }
  };

  if (isLoadingIntegration) {
    return (
      <Card className="glass-card border-border/50">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Calendly Integration Card */}
      <Card className="glass-card border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Calendly</CardTitle>
                <CardDescription>
                  Receba notificações de agendamentos e mostre disponibilidade para clientes
                </CardDescription>
              </div>
            </div>
            {isConnected && (
              <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/30">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Conectado
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isConnected ? (
            <>
              {!showTokenInput ? (
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">
                    Conecte sua conta do Calendly para receber webhooks de novos agendamentos 
                    e permitir que a IA informe disponibilidade aos clientes.
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => setShowTokenInput(true)}
                      className="flex items-center gap-2"
                    >
                      <Link2 className="h-4 w-4" />
                      Conectar Calendly
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => window.open("https://calendly.com/integrations/api_webhooks", "_blank")}
                      className="flex items-center gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Obter Token
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="api-token">API Token do Calendly</Label>
                    <Input
                      id="api-token"
                      type="password"
                      placeholder="Cole seu Personal Access Token aqui"
                      value={apiToken}
                      onChange={(e) => setApiToken(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Obtenha seu token em{" "}
                      <a 
                        href="https://calendly.com/integrations/api_webhooks" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Calendly → Integrações → API & Webhooks
                      </a>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleConnect}
                      disabled={!apiToken.trim() || connectCalendly.isPending}
                    >
                      {connectCalendly.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Conectar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowTokenInput(false);
                        setApiToken("");
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Integração ativa</p>
                  <p className="text-xs text-muted-foreground">
                    Última sincronização:{" "}
                    {integration?.last_sync_at 
                      ? formatDistanceToNow(new Date(integration.last_sync_at), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })
                      : "Nunca"
                    }
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnectCalendly.isPending}
                >
                  {disconnectCalendly.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Unlink className="h-4 w-4 mr-2" />
                      Desconectar
                    </>
                  )}
                </Button>
              </div>

              {/* Webhook Registration */}
              {!integration?.webhook_subscription_id && (
                <div className="flex items-center justify-between p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <div className="flex items-center gap-3">
                    <Bell className="h-5 w-5 text-amber-400" />
                    <div>
                      <p className="text-sm font-medium text-amber-400">Webhook não registrado</p>
                      <p className="text-xs text-muted-foreground">
                        Registre o webhook para receber notificações de agendamentos
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleRegisterWebhook}
                    disabled={registerWebhook.isPending}
                  >
                    {registerWebhook.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Registrar Webhook"
                    )}
                  </Button>
                </div>
              )}

              {integration?.webhook_subscription_id && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                  <div>
                    <p className="text-sm font-medium text-green-400">Webhook ativo</p>
                    <p className="text-xs text-muted-foreground">
                      Você receberá notificações de novos agendamentos automaticamente
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Events */}
      {isConnected && (
        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Agendamentos Recentes
            </CardTitle>
            <CardDescription>
              Últimos eventos recebidos via webhook
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingEvents ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : events && events.length > 0 ? (
              <div className="space-y-3">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className={`p-4 rounded-lg border ${
                      event.canceled_at 
                        ? "bg-red-500/5 border-red-500/20" 
                        : "bg-secondary/50 border-border/50"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{event.event_name || "Agendamento"}</p>
                          {event.canceled_at && (
                            <Badge variant="destructive" className="text-xs">
                              Cancelado
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {event.invitee_name && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {event.invitee_name}
                            </span>
                          )}
                          {event.invitee_email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {event.invitee_email}
                            </span>
                          )}
                          {event.invitee_phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {event.invitee_phone}
                            </span>
                          )}
                        </div>
                      </div>
                      {event.event_start_time && (
                        <div className="text-right text-sm">
                          <p className="font-medium">
                            {format(new Date(event.event_start_time), "dd/MM/yyyy")}
                          </p>
                          <p className="text-muted-foreground">
                            {format(new Date(event.event_start_time), "HH:mm")}
                            {event.event_end_time && (
                              <> - {format(new Date(event.event_end_time), "HH:mm")}</>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                    {event.cancel_reason && (
                      <p className="mt-2 text-sm text-red-400">
                        Motivo: {event.cancel_reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum agendamento recebido ainda</p>
                <p className="text-sm">
                  Os eventos aparecerão aqui quando você receber novos agendamentos
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
