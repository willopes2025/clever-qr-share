import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { Server, RefreshCw, CheckCircle, XCircle, Wifi } from "lucide-react";
import { toast } from "sonner";

export const ApiSettings = () => {
  const { instances } = useWhatsAppInstances();
  const [testing, setTesting] = useState(false);
  const [apiStatus, setApiStatus] = useState<'idle' | 'connected' | 'error'>('idle');

  const connectedInstances = instances?.filter(i => i.status === 'connected') || [];
  const totalInstances = instances?.length || 0;

  const testConnection = async () => {
    setTesting(true);
    try {
      // Simulate API test - in production this would call the Evolution API
      await new Promise(resolve => setTimeout(resolve, 1500));
      setApiStatus('connected');
      toast.success("Conexão com a Evolution API estabelecida!");
    } catch (error) {
      setApiStatus('error');
      toast.error("Falha ao conectar com a Evolution API");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Evolution API
          </CardTitle>
          <CardDescription>
            Status da conexão com a API de envio de mensagens
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${
                apiStatus === 'connected' ? 'bg-green-500' : 
                apiStatus === 'error' ? 'bg-red-500' : 
                'bg-yellow-500'
              }`} />
              <div>
                <p className="font-medium">Status da API</p>
                <p className="text-sm text-muted-foreground">
                  {apiStatus === 'connected' ? 'Conectado' : 
                   apiStatus === 'error' ? 'Erro de conexão' : 
                   'Não verificado'}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={testConnection}
              disabled={testing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${testing ? 'animate-spin' : ''}`} />
              {testing ? 'Testando...' : 'Testar Conexão'}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{totalInstances}</p>
              <p className="text-sm text-muted-foreground">Instâncias Totais</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-green-500">{connectedInstances.length}</p>
              <p className="text-sm text-muted-foreground">Conectadas</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Instâncias WhatsApp
          </CardTitle>
          <CardDescription>
            Status de todas as suas instâncias
          </CardDescription>
        </CardHeader>
        <CardContent>
          {instances && instances.length > 0 ? (
            <div className="space-y-3">
              {instances.map((instance) => (
                <div 
                  key={instance.id} 
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {instance.status === 'connected' ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className="font-medium">{instance.instance_name}</span>
                  </div>
                  <Badge variant={instance.status === 'connected' ? 'default' : 'secondary'}>
                    {instance.status === 'connected' ? 'Conectado' : 'Desconectado'}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Wifi className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma instância configurada</p>
              <p className="text-sm">Vá para a página de Instâncias para criar uma</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhooks</CardTitle>
          <CardDescription>
            Configuração de webhooks para notificações em tempo real
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Badge variant="outline" className="mb-4">Em Breve</Badge>
            <p className="text-muted-foreground">
              A configuração de webhooks estará disponível em uma atualização futura
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
