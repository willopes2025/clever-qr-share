import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Clock, Activity, ChevronDown, ChevronUp } from "lucide-react";
import { useMetaWebhookEvents, MetaWebhookEvent } from "@/hooks/useMetaWebhookEvents";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export const MetaWebhookEventsPanel = () => {
  const { events, isLoading, refetch, lastPostEvent } = useMetaWebhookEvents(20);
  const [isOpen, setIsOpen] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);

  const handleRefresh = async () => {
    setIsRefetching(true);
    await refetch();
    setIsRefetching(false);
  };

  const getStatusIcon = (event: MetaWebhookEvent) => {
    if (event.status_code === 200) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    if (event.status_code === 401) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    if (event.error) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const getMethodBadge = (method: string) => {
    const variant = method === 'POST' ? 'default' : 'secondary';
    const className = method === 'POST' 
      ? 'bg-blue-500/90 text-white text-xs' 
      : 'text-xs';
    return <Badge variant={variant} className={className}>{method}</Badge>;
  };

  const getEventTypeBadge = (eventType: string | null) => {
    if (!eventType) return null;
    const colors: Record<string, string> = {
      message: 'bg-green-500/20 text-green-500 border-green-500/50',
      status: 'bg-blue-500/20 text-blue-500 border-blue-500/50',
      verification: 'bg-purple-500/20 text-purple-500 border-purple-500/50',
      unknown: 'bg-muted text-muted-foreground',
    };
    return (
      <Badge variant="outline" className={`text-xs ${colors[eventType] || colors.unknown}`}>
        {eventType}
      </Badge>
    );
  };

  const postEvents = events?.filter(e => e.method === 'POST') || [];
  const hasRecentPost = lastPostEvent && 
    new Date(lastPostEvent.received_at) > new Date(Date.now() - 24 * 60 * 60 * 1000);

  return (
    <Card className="glass-card border-muted">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Webhook Inspector</CardTitle>
            {hasRecentPost ? (
              <Badge variant="outline" className="text-xs bg-green-500/20 text-green-500 border-green-500/50">
                Recebendo eventos
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs bg-yellow-500/20 text-yellow-500 border-yellow-500/50">
                Aguardando eventos
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefetching}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Last POST event summary */}
        <div className="p-3 rounded-lg bg-muted/50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Último POST recebido:</span>
            {lastPostEvent ? (
              <span className="text-sm font-medium">
                {formatDistanceToNow(new Date(lastPostEvent.received_at), { 
                  addSuffix: true, 
                  locale: ptBR 
                })}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Nenhum</span>
            )}
          </div>
          {lastPostEvent && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Phone Number ID:</span>
                <span className="text-xs font-mono">{lastPostEvent.phone_number_id || '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status:</span>
                <div className="flex items-center gap-1.5">
                  {getStatusIcon(lastPostEvent)}
                  <span className="text-sm">{lastPostEvent.status_code || 'Pendente'}</span>
                </div>
              </div>
              {lastPostEvent.signature_valid !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Assinatura:</span>
                  <Badge variant="outline" className={
                    lastPostEvent.signature_valid 
                      ? 'text-xs bg-green-500/20 text-green-500 border-green-500/50'
                      : 'text-xs bg-red-500/20 text-red-500 border-red-500/50'
                  }>
                    {lastPostEvent.signature_valid ? 'Válida' : 'Inválida'}
                  </Badge>
                </div>
              )}
              {lastPostEvent.error && (
                <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/30">
                  <span className="text-xs text-red-500">{lastPostEvent.error}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Collapsible events list */}
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between">
              <span className="text-sm">
                Últimos {events?.length || 0} eventos
              </span>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {isLoading ? (
              <div className="py-4 text-center text-muted-foreground text-sm">
                Carregando eventos...
              </div>
            ) : events && events.length > 0 ? (
              <ScrollArea className="h-[300px] mt-2">
                <div className="space-y-2 pr-4">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(event)}
                          {getMethodBadge(event.method)}
                          {getEventTypeBadge(event.event_type)}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(event.received_at), "dd/MM HH:mm:ss")}
                        </span>
                      </div>
                      {event.phone_number_id && (
                        <div className="text-xs text-muted-foreground">
                          Phone ID: {event.phone_number_id}
                        </div>
                      )}
                      {event.error && (
                        <div className="text-xs text-red-500 truncate" title={event.error}>
                          {event.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="py-4 text-center text-muted-foreground text-sm">
                Nenhum evento registrado ainda.
                <br />
                <span className="text-xs">
                  Envie uma mensagem para o número Meta para testar.
                </span>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Stats summary */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>Total POST: {postEvents.length}</span>
          <span>
            Sucesso: {postEvents.filter(e => e.status_code === 200).length} | 
            Erro: {postEvents.filter(e => e.status_code !== 200 && e.status_code !== null).length}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
