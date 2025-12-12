import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Wifi, WifiOff } from "lucide-react";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";

export const InstancesOverview = () => {
  const { instances, isLoading } = useWhatsAppInstances();

  if (isLoading) {
    return (
      <Card className="p-6 shadow-medium">
        <h3 className="text-xl font-semibold mb-4">Instâncias WhatsApp</h3>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-12 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 shadow-medium">
      <h3 className="text-xl font-semibold mb-4">Instâncias WhatsApp</h3>
      <div className="space-y-3">
        {instances.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            Nenhuma instância configurada
          </p>
        ) : (
          instances.slice(0, 5).map((instance) => {
            const isConnected = instance.status === 'connected';
            
            return (
              <div
                key={instance.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                    isConnected ? 'bg-green-500/10' : 'bg-red-500/10'
                  }`}>
                    <Smartphone className={`h-4 w-4 ${
                      isConnected ? 'text-green-600' : 'text-red-600'
                    }`} />
                  </div>
                  <span className="font-medium">{instance.instance_name}</span>
                </div>
                <Badge 
                  variant={isConnected ? 'default' : 'secondary'}
                  className={isConnected 
                    ? 'bg-green-500/10 text-green-600 border-green-500/20' 
                    : 'bg-red-500/10 text-red-600 border-red-500/20'
                  }
                >
                  {isConnected ? (
                    <><Wifi className="h-3 w-3 mr-1" /> Conectado</>
                  ) : (
                    <><WifiOff className="h-3 w-3 mr-1" /> Desconectado</>
                  )}
                </Badge>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};
