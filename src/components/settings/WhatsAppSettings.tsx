import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Smartphone, QrCode, RefreshCw, Wifi, WifiOff, CheckCircle } from 'lucide-react';
import { useWhatsAppInstances, WARMING_LEVELS } from '@/hooks/useWhatsAppInstances';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function WhatsAppSettings() {
  const { instances, isLoading, connectInstance, checkStatus } = useWhatsAppInstances();
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async (instanceId: string, instanceName: string) => {
    setSelectedInstance(instanceId);
    setIsConnecting(true);
    
    try {
      const result = await connectInstance.mutateAsync(instanceId);
      if (result?.qrCode) {
        setQrCode(result.qrCode);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleCheckStatus = async (instanceId: string, instanceName: string) => {
    await checkStatus.mutateAsync(instanceId);
  };

  const closeQrDialog = () => {
    setSelectedInstance(null);
    setQrCode(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            <Wifi className="h-3 w-3 mr-1" />
            Conectado
          </Badge>
        );
      case 'connecting':
        return (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            Conectando
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-muted text-muted-foreground">
            <WifiOff className="h-3 w-3 mr-1" />
            Desconectado
          </Badge>
        );
    }
  };

  const getWarmingLevel = (level: number) => {
    return WARMING_LEVELS.find(w => w.level === level) || WARMING_LEVELS[0];
  };

  if (isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Instâncias WhatsApp
          </CardTitle>
          <CardDescription>
            Gerencie suas instâncias do WhatsApp e escaneie o QR Code para conectar
          </CardDescription>
        </CardHeader>
        <CardContent>
          {instances && instances.length > 0 ? (
            <div className="space-y-4">
              {instances.map((instance) => {
                const warming = getWarmingLevel(instance.warming_level);
                return (
                  <div
                    key={instance.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-background/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Smartphone className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium">{instance.instance_name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          {getStatusBadge(instance.status || 'disconnected')}
                          <Badge 
                            variant="outline" 
                            className="text-xs"
                            style={{ borderColor: warming.color, color: warming.color }}
                          >
                            {warming.icon} {warming.name}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCheckStatus(instance.id, instance.instance_name)}
                        disabled={checkStatus.isPending}
                      >
                        <RefreshCw className={`h-4 w-4 mr-1 ${checkStatus.isPending ? 'animate-spin' : ''}`} />
                        Verificar
                      </Button>
                      {instance.status !== 'connected' && (
                        <Button
                          size="sm"
                          onClick={() => handleConnect(instance.id, instance.instance_name)}
                          disabled={isConnecting && selectedInstance === instance.id}
                        >
                          <QrCode className="h-4 w-4 mr-1" />
                          Conectar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Smartphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">Nenhuma instância encontrada</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Crie uma instância na página de Instâncias para começar
              </p>
              <Button variant="outline" asChild>
                <a href="/instances">Ir para Instâncias</a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR Code Dialog */}
      <Dialog open={!!qrCode} onOpenChange={(open) => !open && closeQrDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Escanear QR Code
            </DialogTitle>
            <DialogDescription>
              Abra o WhatsApp no seu celular, vá em Dispositivos Conectados e escaneie o código abaixo
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-6">
            {qrCode && (
              <div className="p-4 bg-white rounded-lg">
                <img
                  src={qrCode}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64"
                />
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-4 text-center">
              O QR Code expira em 45 segundos. Escaneie rapidamente.
            </p>
          </div>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={closeQrDialog}>
              Fechar
            </Button>
            <Button
              onClick={() => {
                const instance = instances?.find(i => i.id === selectedInstance);
                if (instance) {
                  handleConnect(instance.id, instance.instance_name);
                }
              }}
              disabled={isConnecting}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isConnecting ? 'animate-spin' : ''}`} />
              Gerar Novo QR
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
