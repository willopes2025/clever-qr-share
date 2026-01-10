import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Calendar, 
  Check, 
  X, 
  Loader2, 
  ExternalLink,
  RefreshCw,
  Unlink,
  AlertCircle
} from "lucide-react";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

export const GoogleCalendarSettings = () => {
  const { integration, isLoading, isConnected, connectGoogle, disconnectGoogle } = useGoogleCalendar();
  const [searchParams, setSearchParams] = useSearchParams();
  const [autoSync, setAutoSync] = useState(true);

  // Handle OAuth callback messages
  useEffect(() => {
    const googleConnected = searchParams.get('google_connected');
    const email = searchParams.get('email');
    const error = searchParams.get('error');

    if (googleConnected === 'true') {
      toast.success(`Google Calendar conectado${email ? ` (${email})` : ''}!`);
      // Clean up URL params
      searchParams.delete('google_connected');
      searchParams.delete('email');
      setSearchParams(searchParams);
    }

    if (error) {
      const errorMessages: Record<string, string> = {
        'access_denied': 'Acesso negado. Você precisa autorizar o acesso ao Google Calendar.',
        'missing_params': 'Parâmetros ausentes. Tente novamente.',
        'save_failed': 'Erro ao salvar integração. Tente novamente.',
        'callback_failed': 'Erro no callback. Tente novamente.',
      };
      toast.error(errorMessages[error] || `Erro: ${error}`);
      searchParams.delete('error');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  const handleConnect = () => {
    connectGoogle.mutate();
  };

  const handleDisconnect = () => {
    disconnectGoogle.mutate();
  };

  const formatLastSync = (date: string | null) => {
    if (!date) return 'Nunca';
    return new Date(date).toLocaleString('pt-BR');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Google Calendar</CardTitle>
              <CardDescription>
                Sincronize suas tarefas automaticamente com o Google Calendar
              </CardDescription>
            </div>
          </div>
          <Badge variant={isConnected ? "default" : "secondary"} className="gap-1">
            {isConnected ? (
              <>
                <Check className="h-3 w-3" />
                Conectado
              </>
            ) : (
              <>
                <X className="h-3 w-3" />
                Desconectado
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isConnected ? (
          <>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Configuração necessária</AlertTitle>
              <AlertDescription>
                Para usar a integração com Google Calendar, você precisa autorizar o acesso à sua conta Google.
                Suas tarefas serão sincronizadas automaticamente após a conexão.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <h4 className="font-medium">O que será sincronizado:</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Tarefas de conversas com data definida
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Tarefas de negócios (deals) com data definida
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Atualizações em tempo real (criar, editar, excluir)
                </li>
              </ul>
            </div>

            <Button 
              onClick={handleConnect} 
              disabled={connectGoogle.isPending}
              className="w-full"
            >
              {connectGoogle.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Conectar Google Calendar
            </Button>
          </>
        ) : (
          <>
            <div className="grid gap-4">
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <p className="text-xs text-muted-foreground">
                    Última sincronização: {formatLastSync(integration?.last_sync_at || null)}
                  </p>
                </div>
                <Badge variant="outline" className="text-green-600 border-green-600">
                  Ativo
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Calendário</p>
                  <p className="text-xs text-muted-foreground">
                    {integration?.calendar_id === 'primary' ? 'Calendário Principal' : integration?.calendar_id}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-sync">Sincronização automática</Label>
                  <p className="text-xs text-muted-foreground">
                    Sincronizar novas tarefas automaticamente
                  </p>
                </div>
                <Switch
                  id="auto-sync"
                  checked={autoSync}
                  onCheckedChange={setAutoSync}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={handleDisconnect}
                disabled={disconnectGoogle.isPending}
              >
                {disconnectGoogle.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4 mr-2" />
                )}
                Desconectar
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
