import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUserSettings } from "@/hooks/useUserSettings";
import { Megaphone, RefreshCw, AlertTriangle, Bell, Save } from "lucide-react";

export const CampaignSettings = () => {
  const { settings, updateSettings, defaultSettings } = useUserSettings();
  
  const [stopOnError, setStopOnError] = useState(defaultSettings.stop_on_error);
  const [notifyOnComplete, setNotifyOnComplete] = useState(defaultSettings.notify_on_complete);
  const [autoRetry, setAutoRetry] = useState(defaultSettings.auto_retry);
  const [maxRetries, setMaxRetries] = useState(defaultSettings.max_retries);

  useEffect(() => {
    if (settings) {
      setStopOnError(settings.stop_on_error ?? defaultSettings.stop_on_error);
      setNotifyOnComplete(settings.notify_on_complete ?? defaultSettings.notify_on_complete);
      setAutoRetry(settings.auto_retry ?? defaultSettings.auto_retry);
      setMaxRetries(settings.max_retries ?? defaultSettings.max_retries);
    }
  }, [settings, defaultSettings]);

  const handleSave = () => {
    updateSettings.mutate({
      stop_on_error: stopOnError,
      notify_on_complete: notifyOnComplete,
      auto_retry: autoRetry,
      max_retries: maxRetries,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Comportamento em Erros
          </CardTitle>
          <CardDescription>
            Configure como a campanha deve se comportar quando ocorrer um erro
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Parar no Primeiro Erro</Label>
              <p className="text-sm text-muted-foreground">
                Interrompe a campanha imediatamente quando um erro ocorrer
              </p>
            </div>
            <Switch
              checked={stopOnError}
              onCheckedChange={setStopOnError}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Retry Automático
          </CardTitle>
          <CardDescription>
            Configure tentativas automáticas para mensagens que falharem
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Tentar Novamente Automaticamente</Label>
              <p className="text-sm text-muted-foreground">
                Tenta reenviar automaticamente mensagens que falharam
              </p>
            </div>
            <Switch
              checked={autoRetry}
              onCheckedChange={setAutoRetry}
            />
          </div>

          {autoRetry && (
            <div className="flex items-center gap-4">
              <Label>Máximo de Tentativas:</Label>
              <Input
                type="number"
                value={maxRetries}
                onChange={(e) => setMaxRetries(parseInt(e.target.value) || 1)}
                min={1}
                max={10}
                className="w-20"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificações
          </CardTitle>
          <CardDescription>
            Configure quando você deseja ser notificado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Notificar ao Concluir Campanha</Label>
              <p className="text-sm text-muted-foreground">
                Receba uma notificação quando a campanha terminar
              </p>
            </div>
            <Switch
              checked={notifyOnComplete}
              onCheckedChange={setNotifyOnComplete}
            />
          </div>
        </CardContent>
      </Card>

      <Button 
        onClick={handleSave} 
        disabled={updateSettings.isPending}
        className="w-full"
      >
        <Save className="h-4 w-4 mr-2" />
        {updateSettings.isPending ? "Salvando..." : "Salvar Configurações de Campanhas"}
      </Button>
    </div>
  );
};
