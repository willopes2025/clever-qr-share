import { DashboardSidebar } from "@/components/DashboardSidebar";
import { InstanceCard } from "@/components/InstanceCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, RefreshCw, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useWhatsAppInstances, WhatsAppInstance } from "@/hooks/useWhatsAppInstances";

const Instances = () => {
  const {
    instances,
    isLoading,
    refetch,
    createInstance,
    connectInstance,
    checkStatus,
    deleteInstance,
  } = useWhatsAppInstances();

  const [newInstanceName, setNewInstanceName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<WhatsAppInstance | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  // Polling para verificar status de instâncias "connecting"
  useEffect(() => {
    if (!instances) return;

    const connectingInstances = instances.filter(i => i.status === 'connecting');
    if (connectingInstances.length === 0) return;

    const interval = setInterval(() => {
      connectingInstances.forEach((instance) => {
        checkStatus.mutate(instance.instance_name);
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [instances]);

  const handleCreateInstance = async () => {
    if (!newInstanceName.trim()) {
      return;
    }

    await createInstance.mutateAsync(newInstanceName);
    setNewInstanceName("");
    setDialogOpen(false);
  };

  const handleDeleteInstance = async (instanceName: string) => {
    await deleteInstance.mutateAsync(instanceName);
  };

  const handleShowQRCode = async (instance: WhatsAppInstance) => {
    setSelectedInstance(instance);
    setQrDialogOpen(true);
    setQrCodeData(null);
    setQrLoading(true);

    try {
      const result = await connectInstance.mutateAsync(instance.instance_name);
      setQrCodeData(result.base64);
    } catch (error) {
      console.error('Error getting QR code:', error);
    } finally {
      setQrLoading(false);
    }
  };

  const handleRefreshQRCode = async () => {
    if (!selectedInstance) return;
    
    setQrLoading(true);
    setQrCodeData(null);

    try {
      const result = await connectInstance.mutateAsync(selectedInstance.instance_name);
      setQrCodeData(result.base64);
    } catch (error) {
      console.error('Error refreshing QR code:', error);
    } finally {
      setQrLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      
      <main className="ml-64 p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Instâncias</h1>
            <p className="text-muted-foreground">
              Gerencie suas conexões WhatsApp com QR Code ilimitado
            </p>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg">
                  <Plus className="h-5 w-5 mr-2" />
                  Nova Instância
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Nova Instância</DialogTitle>
                  <DialogDescription>
                    Crie uma nova instância para conectar ao WhatsApp via QR Code.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome da Instância</Label>
                    <Input
                      id="name"
                      placeholder="Ex: Vendas, Suporte, Marketing..."
                      value={newInstanceName}
                      onChange={(e) => setNewInstanceName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleCreateInstance();
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleCreateInstance} 
                    className="flex-1"
                    disabled={createInstance.isPending}
                  >
                    {createInstance.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      'Criar Instância'
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : instances && instances.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {instances.map((instance, index) => (
              <motion.div
                key={instance.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <InstanceCard
                  name={instance.instance_name}
                  status={instance.status}
                  onQRCode={() => handleShowQRCode(instance)}
                  onDelete={() => handleDeleteInstance(instance.instance_name)}
                />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-4">
              Nenhuma instância criada ainda.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-5 w-5 mr-2" />
              Criar Primeira Instância
            </Button>
          </div>
        )}

        <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Conectar via QR Code</DialogTitle>
              <DialogDescription>
                Escaneie o QR Code com seu WhatsApp para conectar a instância "{selectedInstance?.instance_name}"
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="bg-muted rounded-xl p-6 flex items-center justify-center min-h-[280px]">
                {qrLoading ? (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
                  </div>
                ) : qrCodeData ? (
                  <div className="bg-background p-4 rounded-lg">
                    <img 
                      src={qrCodeData} 
                      alt="QR Code" 
                      className="w-56 h-56 rounded-lg"
                    />
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-muted-foreground mb-4">
                      Não foi possível gerar o QR Code.
                    </p>
                    <Button onClick={handleRefreshQRCode} variant="outline">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Tentar Novamente
                    </Button>
                  </div>
                )}
              </div>
              
              {qrCodeData && (
                <div className="flex justify-center mt-4">
                  <Button onClick={handleRefreshQRCode} variant="outline" size="sm" disabled={qrLoading}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Gerar Novo QR Code
                  </Button>
                </div>
              )}

              <p className="text-sm text-muted-foreground text-center mt-4">
                Abra o WhatsApp no seu celular → Configurações → Aparelhos conectados → Conectar aparelho
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Instances;
