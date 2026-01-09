import { DashboardLayout } from "@/components/DashboardLayout";
import { InstanceCard } from "@/components/InstanceCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, RefreshCw, Loader2, Smartphone, AlertTriangle, Webhook } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useWhatsAppInstances, WhatsAppInstance } from "@/hooks/useWhatsAppInstances";
import { useSubscription } from "@/hooks/useSubscription";
import { useFunnels } from "@/hooks/useFunnels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "react-router-dom";
import { InstanceFunnelDialog } from "@/components/instances/InstanceFunnelDialog";
import { SyncHistoryDialog } from "@/components/instances/SyncHistoryDialog";
import { InstanceFilters, InstanceFiltersState } from "@/components/instances/InstanceFilters";
import { InstancesListView } from "@/components/instances/InstancesListView";
import { EditDeviceDialog } from "@/components/instances/EditDeviceDialog";
import { InstanceMembersDialog } from "@/components/instances/InstanceMembersDialog";

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
    updateDefaultFunnel,
    updateInstanceDetails,
  } = useWhatsAppInstances();
  
  const { subscription, isSubscribed, currentPlan, canCreateInstance, createCheckout } = useSubscription();
  const { funnels } = useFunnels();

  const [newInstanceName, setNewInstanceName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<WhatsAppInstance | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [confirmRecreateDialog, setConfirmRecreateDialog] = useState(false);
  const [pendingInstanceName, setPendingInstanceName] = useState("");
  const [funnelDialogOpen, setFunnelDialogOpen] = useState(false);
  const [funnelDialogInstance, setFunnelDialogInstance] = useState<WhatsAppInstance | null>(null);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncDialogInstance, setSyncDialogInstance] = useState<WhatsAppInstance | null>(null);
  const [deviceDialogOpen, setDeviceDialogOpen] = useState(false);
  const [deviceDialogInstance, setDeviceDialogInstance] = useState<WhatsAppInstance | null>(null);
  
  // Members dialog for new instance
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [newlyCreatedInstance, setNewlyCreatedInstance] = useState<{ id: string; name: string } | null>(null);
  
  // Filters and view mode
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState<InstanceFiltersState>({
    status: 'all',
    warmingLevel: null,
    funnelId: null,
  });

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

  // Filter instances
  const filteredInstances = useMemo(() => {
    if (!instances) return [];
    
    return instances.filter(instance => {
      // Status filter
      if (filters.status !== 'all') {
        if (filters.status === 'connected' && instance.status !== 'connected') return false;
        if (filters.status === 'disconnected' && instance.status !== 'connected') {
          // Include both 'disconnected' and 'connecting' as disconnected
        } else if (filters.status === 'disconnected' && instance.status === 'connected') {
          return false;
        }
      }
      
      // Warming level filter
      if (filters.warmingLevel !== null && instance.warming_level !== filters.warmingLevel) {
        return false;
      }
      
      // Funnel filter
      if (filters.funnelId !== null) {
        if (filters.funnelId === 'none' && instance.default_funnel_id !== null) return false;
        if (filters.funnelId !== 'none' && instance.default_funnel_id !== filters.funnelId) return false;
      }
      
      return true;
    });
  }, [instances, filters]);

  const instanceCount = instances?.length || 0;
  const maxInstances = subscription?.max_instances;

  const handleCreateInstance = async (forceRecreate = false) => {
    const nameToUse = forceRecreate ? pendingInstanceName : newInstanceName;
    
    if (!nameToUse.trim()) {
      toast.error("Digite um nome para a instância");
      return;
    }
    
    if (!canCreateInstance) {
      if (!isSubscribed) {
        toast.error("Você precisa de uma assinatura ativa para criar instâncias");
      } else if (maxInstances !== null) {
        toast.error(`Você atingiu o limite de ${maxInstances} instância${maxInstances > 1 ? "s" : ""} do seu plano ${currentPlan}`);
      } else {
        toast.error("Não foi possível criar instância no momento");
      }
      return;
    }

    try {
      const result = await createInstance.mutateAsync({ instanceName: nameToUse, forceRecreate });
      setNewInstanceName("");
      setPendingInstanceName("");
      setDialogOpen(false);
      setConfirmRecreateDialog(false);
      
      // Open members dialog after instance is created
      if (result?.instance?.id) {
        setNewlyCreatedInstance({ id: result.instance.id, name: nameToUse });
        setMembersDialogOpen(true);
      }
    } catch (error: unknown) {
      const err = error as Error & { code?: string; instanceName?: string };
      if (err.code === 'INSTANCE_EXISTS_IN_EVOLUTION') {
        setPendingInstanceName(err.instanceName || nameToUse);
        setDialogOpen(false);
        setConfirmRecreateDialog(true);
      }
    }
  };

  const handleMembersSaved = () => {
    setMembersDialogOpen(false);
    setNewlyCreatedInstance(null);
    toast.success("Instância criada com sucesso!");
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
    <DashboardLayout className="p-8 isolate cyber-grid">
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
      
      {isSubscribed && maxInstances !== null && !canCreateInstance && (
        <Alert className="mb-6 border-orange-500/50 bg-orange-500/10">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <AlertTitle className="text-orange-500">Limite atingido</AlertTitle>
          <AlertDescription>
            Você atingiu o limite de {maxInstances} instância{maxInstances > 1 ? 's' : ''} do seu plano {currentPlan}.{' '}
            <button 
              onClick={() => createCheckout(currentPlan === 'essencial' ? 'profissional' : 'agencia')}
              className="text-primary hover:underline font-medium"
            >
              Fazer upgrade
            </button>
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
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
                disabled={!canCreateInstance}
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
                        handleCreateInstance(false);
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
                  onClick={() => handleCreateInstance(false)} 
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

          {/* Confirm Recreate Dialog */}
          <Dialog open={confirmRecreateDialog} onOpenChange={setConfirmRecreateDialog}>
            <DialogContent className="glass-card border-orange-500/30">
              <DialogHeader>
                <DialogTitle className="text-orange-500 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Instância já existe
                </DialogTitle>
                <DialogDescription>
                  Já existe uma instância chamada "<strong>{pendingInstanceName}</strong>" na Evolution API.
                  Deseja excluí-la e criar uma nova?
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <p className="text-sm text-muted-foreground">
                  ⚠️ Esta ação irá excluir a instância existente na Evolution API e criar uma nova. 
                  Todas as conexões e configurações anteriores serão perdidas.
                </p>
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setConfirmRecreateDialog(false);
                    setPendingInstanceName("");
                  }} 
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={() => handleCreateInstance(true)} 
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                  disabled={createInstance.isPending}
                >
                  {createInstance.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Recriando...
                    </>
                  ) : (
                    'Excluir e Recriar'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <InstanceFilters
          filters={filters}
          onFiltersChange={setFilters}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          funnels={funnels || []}
        />
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl bg-dark-800/50" />
          ))}
        </div>
      ) : filteredInstances.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredInstances.map((instance, index) => (
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
                  funnelName={instance.funnel?.name}
                  funnelColor={instance.funnel?.color}
                  phoneNumber={instance.phone_number}
                  profileName={instance.profile_name}
                  profilePictureUrl={instance.profile_picture_url}
                  isBusiness={instance.is_business}
                  deviceLabel={instance.device_label}
                  chipDevice={instance.chip_device}
                  whatsappDevice={instance.whatsapp_device}
                  connectedAt={instance.connected_at}
                  onQRCode={() => handleShowQRCode(instance)}
                  onDelete={() => handleDeleteInstance(instance.instance_name)}
                  onWarmingChange={(level) => handleWarmingChange(instance.id, level)}
                  onConfigureFunnel={() => {
                    setFunnelDialogInstance(instance);
                    setFunnelDialogOpen(true);
                  }}
                  onSyncHistory={() => {
                    setSyncDialogInstance(instance);
                    setSyncDialogOpen(true);
                  }}
                  onEditDevice={() => {
                    setDeviceDialogInstance(instance);
                    setDeviceDialogOpen(true);
                  }}
                />
              </motion.div>
            ))}
          </div>
        ) : (
          <InstancesListView
            instances={filteredInstances}
            onQRCode={handleShowQRCode}
            onDelete={handleDeleteInstance}
            onConfigureFunnel={(instance) => {
              setFunnelDialogInstance(instance);
              setFunnelDialogOpen(true);
            }}
            onSyncHistory={(instance) => {
              setSyncDialogInstance(instance);
              setSyncDialogOpen(true);
            }}
            onEditDevice={(instance) => {
              setDeviceDialogInstance(instance);
              setDeviceDialogOpen(true);
            }}
          />
        )
      ) : instances && instances.length > 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground mb-4">
            Nenhuma instância encontrada com os filtros selecionados.
          </p>
          <Button
            variant="outline"
            onClick={() => setFilters({ status: 'all', warmingLevel: null, funnelId: null })}
          >
            Limpar filtros
          </Button>
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
              if (canCreateInstance) {
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

      {/* Funnel Configuration Dialog */}
      {funnelDialogInstance && (
        <InstanceFunnelDialog
          open={funnelDialogOpen}
          onOpenChange={setFunnelDialogOpen}
          instanceId={funnelDialogInstance.id}
          instanceName={funnelDialogInstance.instance_name}
          currentFunnelId={funnelDialogInstance.default_funnel_id}
          onSave={async (funnelId) => {
            await updateDefaultFunnel.mutateAsync({
              instanceId: funnelDialogInstance.id,
              funnelId,
            });
          }}
        />
      )}

      {/* Sync History Dialog */}
      {syncDialogInstance && (
        <SyncHistoryDialog
          open={syncDialogOpen}
          onOpenChange={setSyncDialogOpen}
          instanceName={syncDialogInstance.instance_name}
          onSuccess={() => refetch()}
        />
      )}

      {/* Edit Device Dialog */}
      {deviceDialogInstance && (
        <EditDeviceDialog
          open={deviceDialogOpen}
          onOpenChange={setDeviceDialogOpen}
          instanceId={deviceDialogInstance.id}
          currentInstanceName={deviceDialogInstance.instance_name}
          currentPhoneNumber={deviceDialogInstance.phone_number}
          currentChipDevice={deviceDialogInstance.chip_device}
          currentWhatsappDevice={deviceDialogInstance.whatsapp_device}
          onSave={async (data) => {
            await updateInstanceDetails.mutateAsync({
              instanceId: deviceDialogInstance.id,
              instanceName: data.instanceName,
              phoneNumber: data.phoneNumber,
              chipDevice: data.chipDevice,
              whatsappDevice: data.whatsappDevice,
            });
          }}
          isLoading={updateInstanceDetails.isPending}
        />
      )}

      {/* Members Dialog for new instance */}
      {newlyCreatedInstance && (
        <InstanceMembersDialog
          open={membersDialogOpen}
          onOpenChange={(open) => {
            setMembersDialogOpen(open);
            if (!open) {
              setNewlyCreatedInstance(null);
            }
          }}
          instanceId={newlyCreatedInstance.id}
          instanceName={newlyCreatedInstance.name}
          onSaved={handleMembersSaved}
        />
      )}
    </DashboardLayout>
  );
};

export default Instances;