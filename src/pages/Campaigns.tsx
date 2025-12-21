import { useState } from 'react';
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Send, Loader2 } from "lucide-react";
import { useCampaigns, useCampaignMutations, Campaign, SendingMode } from "@/hooks/useCampaigns";
import { CampaignCard } from "@/components/campaigns/CampaignCard";
import { CampaignFormDialog } from "@/components/campaigns/CampaignFormDialog";
import { CampaignTracker } from "@/components/campaigns/CampaignTracker";
import { SelectInstanceDialog } from "@/components/campaigns/SelectInstanceDialog";

const Campaigns = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [deletingCampaign, setDeletingCampaign] = useState<Campaign | null>(null);
  const [trackingCampaign, setTrackingCampaign] = useState<Campaign | null>(null);
  const [startingCampaign, setStartingCampaign] = useState<Campaign | null>(null);

  const { data: campaigns, isLoading } = useCampaigns();
  const { createCampaign, updateCampaign, deleteCampaign, startCampaign, cancelCampaign } = useCampaignMutations();

  const filteredCampaigns = campaigns?.filter(campaign => {
    const matchesSearch = campaign.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const handleCreate = async (data: {
    name: string;
    template_id: string | null;
    list_id: string | null;
    scheduled_at: string | null;
    message_interval_min: number;
    message_interval_max: number;
    daily_limit: number;
    allowed_start_hour: number;
    allowed_end_hour: number;
    allowed_days: string[];
    timezone: string;
  }) => {
    await createCampaign.mutateAsync(data);
    setIsFormOpen(false);
  };

  const handleUpdate = async (data: {
    name: string;
    template_id: string | null;
    list_id: string | null;
    scheduled_at: string | null;
    message_interval_min: number;
    message_interval_max: number;
    daily_limit: number;
    allowed_start_hour: number;
    allowed_end_hour: number;
    allowed_days: string[];
    timezone: string;
  }) => {
    if (!editingCampaign) return;
    await updateCampaign.mutateAsync({ id: editingCampaign.id, ...data });
    setEditingCampaign(null);
  };

  const handleDelete = async () => {
    if (!deletingCampaign) return;
    await deleteCampaign.mutateAsync(deletingCampaign.id);
    setDeletingCampaign(null);
  };

  const handleStartWithInstances = async (data: { instanceIds: string[]; sendingMode: SendingMode }) => {
    if (!startingCampaign) return;
    await startCampaign.mutateAsync({ 
      campaignId: startingCampaign.id, 
      instanceIds: data.instanceIds,
      sendingMode: data.sendingMode
    });
    setStartingCampaign(null);
    // Open tracker to show progress
    setTrackingCampaign({ ...startingCampaign, status: 'sending' });
  };

  const handleCancel = async (campaign: Campaign) => {
    await cancelCampaign.mutateAsync(campaign.id);
  };

  return (
    <div className="min-h-screen bg-background cyber-grid">
      <DashboardSidebar />
      
      <main className="ml-64 p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold mb-2 text-glow-cyan">Campanhas de Disparo</h1>
            <p className="text-muted-foreground">
              Crie e gerencie suas campanhas de mensagens em massa
            </p>
          </div>

          <Button size="lg" onClick={() => setIsFormOpen(true)} className="bg-gradient-neon hover:opacity-90">
            <Plus className="h-5 w-5 mr-2" />
            Nova Campanha
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar campanhas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-dark-800/50 border-neon-cyan/30 focus:border-neon-cyan"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] bg-dark-800/50 border-neon-cyan/30">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="draft">Rascunho</SelectItem>
              <SelectItem value="scheduled">Agendada</SelectItem>
              <SelectItem value="sending">Enviando</SelectItem>
              <SelectItem value="completed">Concluída</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-neon-cyan" />
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-gradient-neon mb-6 pulse-neon">
              <Send className="h-10 w-10 text-dark-900" />
            </div>
            <h2 className="text-2xl font-bold mb-2">
              {campaigns?.length === 0 ? 'Nenhuma campanha criada' : 'Nenhuma campanha encontrada'}
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {campaigns?.length === 0 
                ? 'Crie sua primeira campanha para começar a enviar mensagens em massa.'
                : 'Tente ajustar os filtros de busca.'}
            </p>
            {campaigns?.length === 0 && (
              <Button onClick={() => setIsFormOpen(true)} className="bg-gradient-neon">
                <Plus className="h-4 w-4 mr-2" />
                Criar Campanha
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredCampaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onEdit={() => setEditingCampaign(campaign)}
                onDelete={() => setDeletingCampaign(campaign)}
                onStart={() => setStartingCampaign(campaign)}
                onCancel={() => handleCancel(campaign)}
                onTrack={() => setTrackingCampaign(campaign)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Form Dialog */}
      <CampaignFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleCreate}
        isLoading={createCampaign.isPending}
      />

      {/* Edit Dialog */}
      <CampaignFormDialog
        open={!!editingCampaign}
        onOpenChange={(open) => !open && setEditingCampaign(null)}
        campaign={editingCampaign}
        onSubmit={handleUpdate}
        isLoading={updateCampaign.isPending}
      />

      {/* Select Instance Dialog */}
      <SelectInstanceDialog
        open={!!startingCampaign}
        onOpenChange={(open) => !open && setStartingCampaign(null)}
        onConfirm={handleStartWithInstances}
        isLoading={startCampaign.isPending}
        campaignName={startingCampaign?.name}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingCampaign} onOpenChange={(open) => !open && setDeletingCampaign(null)}>
        <AlertDialogContent className="glass-card border-neon-magenta/30">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Campanha</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a campanha "{deletingCampaign?.name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Campaign Tracker */}
      <CampaignTracker
        open={!!trackingCampaign}
        onOpenChange={(open) => !open && setTrackingCampaign(null)}
        campaign={trackingCampaign}
      />
    </div>
  );
};

export default Campaigns;