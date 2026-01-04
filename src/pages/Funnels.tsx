import { useState } from "react";
import { Plus, Target, LayoutGrid, List, Settings2, Zap, BarChart3, Bot, Trash2, Pencil, Workflow } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { FeatureGate } from "@/components/FeatureGate";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useFunnels } from "@/hooks/useFunnels";
import { FunnelKanbanView } from "@/components/funnels/FunnelKanbanView";
import { FunnelListView } from "@/components/funnels/FunnelListView";
import { FunnelFormDialog } from "@/components/funnels/FunnelFormDialog";
import { FunnelMetricsCard } from "@/components/funnels/FunnelMetricsCard";
import { FunnelDashboard } from "@/components/funnels/FunnelDashboard";
import { CloseReasonsManager } from "@/components/funnels/CloseReasonsManager";
import { AutomationsDialog } from "@/components/funnels/AutomationsDialog";
import { FunnelAIDialog } from "@/components/funnels/FunnelAIDialog";
import { FunnelAutomationsView } from "@/components/funnels/automations/FunnelAutomationsView";
import { Skeleton } from "@/components/ui/skeleton";

const Funnels = () => {
  const { funnels, isLoading, deleteFunnel } = useFunnels();
  const [selectedFunnelId, setSelectedFunnelId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'automations' | 'dashboard'>('kanban');
  const [showFunnelForm, setShowFunnelForm] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<{ id: string; name: string; description?: string; color?: string } | null>(null);
  const [showCloseReasons, setShowCloseReasons] = useState(false);
  const [showAutomations, setShowAutomations] = useState(false);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [funnelToDelete, setFunnelToDelete] = useState<{ id: string; name: string } | null>(null);

  // Auto-select first funnel
  const currentFunnel = funnels?.find(f => f.id === selectedFunnelId) || funnels?.[0];
  
  if (currentFunnel && !selectedFunnelId) {
    setSelectedFunnelId(currentFunnel.id);
  }

  const handleDeleteFunnel = async () => {
    if (!funnelToDelete) return;
    await deleteFunnel.mutateAsync(funnelToDelete.id);
    setFunnelToDelete(null);
    // Select another funnel after deletion
    if (selectedFunnelId === funnelToDelete.id) {
      const remaining = funnels?.filter(f => f.id !== funnelToDelete.id);
      setSelectedFunnelId(remaining?.[0]?.id || null);
    }
  };

  return (
    <DashboardLayout>
      <FeatureGate feature="funnels">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Funis de Vendas</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie seus pipelines e acompanhe negócios
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCloseReasons(true)}>
              <Settings2 className="h-4 w-4 mr-2" />
              Motivos
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowAutomations(true)}>
              <Zap className="h-4 w-4 mr-2" />
              Automações
            </Button>
            {currentFunnel && (
              <Button variant="outline" size="sm" onClick={() => setShowAIDialog(true)}>
                <Bot className="h-4 w-4 mr-2" />
                Agente IA
              </Button>
            )}
            <Button onClick={() => setShowFunnelForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Funil
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-[500px] w-full" />
          </div>
        ) : !funnels?.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Target className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Nenhum funil criado</h3>
            <p className="text-muted-foreground mb-4 max-w-sm">
              Crie seu primeiro funil para começar a organizar seus leads e acompanhar negócios.
            </p>
            <Button onClick={() => setShowFunnelForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Funil
            </Button>
          </div>
        ) : (
          <>
            {/* Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Select value={selectedFunnelId || ''} onValueChange={setSelectedFunnelId}>
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="Selecionar funil" />
                  </SelectTrigger>
                  <SelectContent>
                    {funnels.map(funnel => (
                      <SelectItem key={funnel.id} value={funnel.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="h-3 w-3 rounded-full" 
                            style={{ backgroundColor: funnel.color }}
                          />
                          {funnel.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {currentFunnel && (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setEditingFunnel({
                        id: currentFunnel.id,
                        name: currentFunnel.name,
                        description: currentFunnel.description || undefined,
                        color: currentFunnel.color
                      })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setFunnelToDelete({ id: currentFunnel.id, name: currentFunnel.name })}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>

              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'kanban' | 'list' | 'automations' | 'dashboard')}>
                <TabsList>
                  <TabsTrigger value="kanban">
                    <LayoutGrid className="h-4 w-4 mr-2" />
                    Kanban
                  </TabsTrigger>
                  <TabsTrigger value="list">
                    <List className="h-4 w-4 mr-2" />
                    Lista
                  </TabsTrigger>
                  <TabsTrigger value="automations">
                    <Workflow className="h-4 w-4 mr-2" />
                    Automatize
                  </TabsTrigger>
                  <TabsTrigger value="dashboard">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Métricas
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Metrics (only in kanban/list view) */}
            {currentFunnel && viewMode !== 'dashboard' && viewMode !== 'automations' && <FunnelMetricsCard funnel={currentFunnel} />}

            {/* View */}
            {currentFunnel && (
              viewMode === 'kanban' 
                ? <FunnelKanbanView funnel={currentFunnel} />
                : viewMode === 'list'
                  ? <FunnelListView funnel={currentFunnel} />
                  : viewMode === 'automations'
                    ? <FunnelAutomationsView funnel={currentFunnel} />
                    : <FunnelDashboard funnel={currentFunnel} />
            )}
          </>
        )}
      </div>

      <FunnelFormDialog 
        open={showFunnelForm || !!editingFunnel} 
        onOpenChange={(open) => {
          if (!open) {
            setShowFunnelForm(false);
            setEditingFunnel(null);
          }
        }} 
        funnel={editingFunnel || undefined}
      />
      <CloseReasonsManager open={showCloseReasons} onOpenChange={setShowCloseReasons} />
      <AutomationsDialog 
        open={showAutomations} 
        onOpenChange={setShowAutomations} 
        funnelId={currentFunnel?.id}
      />
      {currentFunnel && (
        <FunnelAIDialog
          open={showAIDialog}
          onOpenChange={setShowAIDialog}
          funnelId={currentFunnel.id}
          funnelName={currentFunnel.name}
        />
      )}

      <AlertDialog open={!!funnelToDelete} onOpenChange={(open) => !open && setFunnelToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir funil</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o funil <strong>{funnelToDelete?.name}</strong>? 
              Esta ação é irreversível e todos os deals associados serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFunnel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </FeatureGate>
    </DashboardLayout>
  );
};

export default Funnels;
