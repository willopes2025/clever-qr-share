import { DashboardSidebar } from "@/components/DashboardSidebar";
import { InstanceCard } from "@/components/InstanceCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, RefreshCw, Loader2, Smartphone, AlertTriangle, Webhook } from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useWhatsAppInstances, WhatsAppInstance } from "@/hooks/useWhatsAppInstances";
import { useSubscription } from "@/hooks/useSubscription";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "react-router-dom";
const Instances = () => {
  const {
    instances,
    isLoading,
    refetch,
    createInstance,
    connectInstance,
    checkStatus,
    deleteInstance,
    updateWarmingLevel,
    configureWebhook,
  } = useWhatsAppInstances();
  
  const { subscription, isSubscribed, currentPlan, canCreateInstance, createCheckout } = useSubscription();

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

  const instanceCount = instances?.length || 0;
  const canCreate = canCreateInstance(instanceCount);
  const maxInstances = subscription?.max_instances;

  const handleCreateInstance = async () => {
    if (!newInstanceName.trim()) {
      toast.error("Digite um nome para a instância");
      return;
    }
    
    if (!canCreate) {
      if (!isSubscribed) {
        toast.error("Você precisa de uma assinatura ativa para criar instâncias");
      } else if (maxInstances !== null) {
        toast.error(`Você atingiu o limite de ${maxInstances} instância${maxInstances > 1 ? "s" : ""} do seu plano ${currentPlan}`);
      } else {
        toast.error("Não foi possível criar instância no momento");
      }
      return;
    }

    await createInstance.mutateAsync(newInstanceName);
    setNewInstanceName("");
    setDialogOpen(false);
  };

  const handleDeleteInstance = async (instanceName: string) => {
    await deleteInstance.mutateAsync(instanceName);
  };

  const handleWarmingChange = (instanceId: string, level: number) => {
    updateWarmingLevel.mutate({ instanceId, warmingLevel: level });
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
    <div className="min-h-screen bg-background cyber-grid">
      <DashboardSidebar />
      
      <main className="ml-64 p-8 isolate">
        {/* Subscription limit alert */}
        {!isSubscribed && (
          <Alert className="mb-6 border-yellow-500/50 bg-yellow-500/10">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <AlertTitle className="text-yellow-500">Assinatura necessária</AlertTitle>
            <AlertDescription>
              Você precisa de uma assinatura ativa para criar instâncias.{' '}
              <Link to="/#pricing" className="text-primary hover:underline font-medium">
                Ver planos
              </Link>
            </AlertDescription>
          </Alert>
        )}
        
        {isSubscribed && maxInstances !== null && !canCreate && (
          <Alert className="mb-6 border-orange-500/50 bg-orange-500/10">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <AlertTitle className="text-orange-500">Limite atingido</AlertTitle>
            <AlertDescription>
              Você atingiu o limite de {maxInstances} instância{maxInstances > 1 ? 's' : ''} do seu plano {currentPlan}.{' '}
              <button 
                onClick={() => createCheckout(currentPlan === 'starter' ? 'pro' : 'business')}
                className="text-primary hover:underline font-medium"
              >
                Fazer upgrade
              </button>
            </AlertDescription>
          </Alert>
        )}

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold mb-2 text-glow-cyan">Instâncias</h1>
            <p className="text-muted-foreground">
              Gerencie suas conexões WhatsApp 
              {maxInstances !== null && (
                <span className="ml-2 text-sm">
                  ({instanceCount}/{maxInstances} usadas)
                </span>
              )}
            </p>
          </div>

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => configureWebhook.mutate({ configureAll: true })} 
              className="neon-border"
              disabled={configureWebhook.isPending || !instances?.length}
            >
              {configureWebhook.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Webhook className="h-4 w-4 mr-2" />
              )}
              Configurar Webhooks
            </Button>
            <Button variant="outline" onClick={() => refetch()} className="neon-border">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  size="lg" 
                  className="bg-gradient-neon hover:opacity-90 transition-opacity"
                  disabled={!canCreate}
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Nova Instância
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card border-neon-cyan/30">
                <DialogHeader>
                  <DialogTitle className="text-glow-cyan">Criar Nova Instância</DialogTitle>
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
                      className="bg-secondary/50 border-neon-cyan/30 focus:border-neon-cyan text-foreground relative z-50"
                    />
                  </div>
                </div>
                <div className="flex gap-3 relative z-50">
                  <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1 relative z-50">
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleCreateInstance} 
                    className="flex-1 bg-gradient-neon relative z-50"
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
              <Skeleton key={i} className="h-40 rounded-xl bg-dark-800/50" />
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
                  warmingLevel={instance.warming_level}
                  onQRCode={() => handleShowQRCode(instance)}
                  onDelete={() => handleDeleteInstance(instance.instance_name)}
                  onWarmingChange={(level) => handleWarmingChange(instance.id, level)}
                />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-gradient-neon mb-6 pulse-neon">
              <Smartphone className="h-10 w-10 text-dark-900" />
            </div>
            <p className="text-muted-foreground mb-4">
              Nenhuma instância criada ainda.
            </p>
            <Button
              onClick={() => {
                if (canCreate) {
                  setDialogOpen(true);
                  return;
                }

                if (!isSubscribed) {
                  toast.error("Você precisa de uma assinatura ativa para criar instâncias");
                  return;
                }

                if (maxInstances !== null) {
                  toast.error(`Você atingiu o limite de ${maxInstances} instância${maxInstances > 1 ? "s" : ""} do seu plano ${currentPlan}`);
                  return;
                }

                toast.error("Não foi possível criar instância no momento");
              }}
              className="bg-gradient-neon relative z-50"
            >
              <Plus className="h-5 w-5 mr-2" />
              Criar Primeira Instância
            </Button>
          </div>
        )}

        <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogContent className="max-w-md glass-card border-neon-cyan/30">
            <DialogHeader>
              <DialogTitle className="text-glow-cyan">Conectar via QR Code</DialogTitle>
              <DialogDescription>
                Escaneie o QR Code com seu WhatsApp para conectar a instância "{selectedInstance?.instance_name}"
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="bg-dark-800/50 rounded-xl p-6 flex items-center justify-center min-h-[280px] neon-border">
                {qrLoading ? (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-neon-cyan" />
                    <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
                  </div>
                ) : qrCodeData ? (
                  <div className="bg-white p-4 rounded-lg">
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
                    <Button onClick={handleRefreshQRCode} variant="outline" className="neon-border">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Tentar Novamente
                    </Button>
                  </div>
                )}
              </div>
              
              {qrCodeData && (
                <div className="flex justify-center mt-4">
                  <Button onClick={handleRefreshQRCode} variant="outline" size="sm" disabled={qrLoading} className="neon-border">
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