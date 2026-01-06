import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, Users, RefreshCw, Coins, LogOut, LayoutDashboard, DollarSign, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminStatsCards } from "@/components/admin/AdminStatsCards";
import { UserSubscriptionsTable } from "@/components/admin/UserSubscriptionsTable";
import { EditSubscriptionDialog } from "@/components/admin/EditSubscriptionDialog";
import { SubscriptionHistoryDialog } from "@/components/admin/SubscriptionHistoryDialog";
import { TransferTokensDialog } from "@/components/admin/TransferTokensDialog";
import { useAITokens } from "@/hooks/useAITokens";
import { useOwnerMetrics } from "@/hooks/useOwnerMetrics";
import { useStripeMetrics } from "@/hooks/useStripeMetrics";
import { TooltipProvider } from "@/components/ui/tooltip";
import OwnerOverview from "@/components/owner/OwnerOverview";
import OwnerFinanceiro from "@/components/owner/OwnerFinanceiro";
import OwnerOperacional from "@/components/owner/OwnerOperacional";
import { useActivitySession } from "@/hooks/useActivitySession";

interface UserWithSubscription {
  id: string;
  email: string;
  created_at: string;
  token_balance?: number;
  subscription: {
    id: string;
    plan: string;
    status: string;
    max_instances: number;
    max_messages: number | null;
    max_contacts: number | null;
    current_period_end: string | null;
    stripe_subscription_id: string | null;
  } | null;
}

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { user, signOut } = useAuth();
  const { balance, formatTokens, fetchBalance } = useAITokens();
  const { metrics, loading: metricsLoading, refetch: refetchMetrics } = useOwnerMetrics();
  const { metrics: stripeMetrics, loading: stripeLoading, refetch: refetchStripe } = useStripeMetrics();
  const [users, setUsers] = useState<UserWithSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserWithSubscription | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historySubscriptionId, setHistorySubscriptionId] = useState<string | null>(null);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferTargetUser, setTransferTargetUser] = useState<{ id: string; email: string } | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-update-subscription', {
        body: { action: 'list_users' }
      });

      if (error) throw error;
      setUsers(data.users || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const handleRefresh = () => {
    fetchUsers();
    refetchMetrics();
    refetchStripe();
  };

  const handleEditUser = (user: UserWithSubscription) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const handleViewHistory = (subscriptionId: string) => {
    setHistorySubscriptionId(subscriptionId);
    setHistoryDialogOpen(true);
  };

  const handleSubscriptionUpdated = () => {
    fetchUsers();
    setEditDialogOpen(false);
    setSelectedUser(null);
  };

  const handleTransferTokens = (user: UserWithSubscription) => {
    setTransferTargetUser({ id: user.id, email: user.email });
    setTransferDialogOpen(true);
  };

  const handleTransferSuccess = () => {
    fetchUsers();
    fetchBalance();
  };

  const handleDeleteUser = async (userId: string) => {
    setDeletingUserId(userId);
    try {
      const { data, error } = await supabase.functions.invoke('admin-update-subscription', {
        body: { action: 'delete_user', userId }
      });

      if (error) throw error;
      
      toast.success('Usuário excluído com sucesso');
      fetchUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      toast.error('Erro ao excluir usuário');
    } finally {
      setDeletingUserId(null);
    }
  };

  const { endSession } = useActivitySession();

  const handleSignOut = async () => {
    // End activity session before logout
    await endSession();
    
    await signOut();
    navigate('/login');
  };

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // Calcular estatísticas
  const totalUsers = users.length;
  const activeSubscriptions = users.filter(u => u.subscription?.status === 'active').length;
  const planCounts = users.reduce((acc, u) => {
    const plan = u.subscription?.plan || 'none';
    acc[plan] = (acc[plan] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <TooltipProvider>
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          {/* Header Standalone */}
          <header className="flex items-center justify-between bg-card/50 backdrop-blur-sm rounded-2xl p-4 border border-border/50">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                <Shield className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Admin Token Balance */}
              <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                <Coins className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                  {formatTokens(balance?.balance || 0)}
                </span>
              </div>
              <Button onClick={handleRefresh} variant="outline" size="sm" className="gap-2">
                <RefreshCw className={`h-4 w-4 ${loading || metricsLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button onClick={handleSignOut} variant="ghost" size="sm" className="gap-2 text-muted-foreground">
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </div>
          </header>

          {/* Tabs com todo conteúdo */}
          <Tabs defaultValue="usuarios" className="space-y-6">
            <TabsList className="grid w-full max-w-2xl grid-cols-4 bg-card/50 backdrop-blur-sm">
              <TabsTrigger value="usuarios" className="gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Usuários</span>
              </TabsTrigger>
              <TabsTrigger value="metricas" className="gap-2">
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Métricas</span>
              </TabsTrigger>
              <TabsTrigger value="financeiro" className="gap-2">
                <DollarSign className="h-4 w-4" />
                <span className="hidden sm:inline">Financeiro</span>
              </TabsTrigger>
              <TabsTrigger value="operacional" className="gap-2">
                <Activity className="h-4 w-4" />
                <span className="hidden sm:inline">Operacional</span>
              </TabsTrigger>
            </TabsList>

            {/* Tab Usuários (Admin original) */}
            <TabsContent value="usuarios" className="space-y-6">
              <AdminStatsCards
                totalUsers={totalUsers}
                activeSubscriptions={activeSubscriptions}
                planCounts={planCounts}
              />

              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Usuários e Assinaturas
                  </CardTitle>
                  <CardDescription>
                    Lista de todos os usuários e suas assinaturas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <UserSubscriptionsTable
                    users={users}
                    loading={loading}
                    onEditUser={handleEditUser}
                    onViewHistory={handleViewHistory}
                    onDeleteUser={handleDeleteUser}
                    onTransferTokens={handleTransferTokens}
                    deletingUserId={deletingUserId}
                    formatTokens={formatTokens}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab Métricas (Owner Overview) */}
            <TabsContent value="metricas">
              <OwnerOverview metrics={metrics} loading={metricsLoading} />
            </TabsContent>

            {/* Tab Financeiro */}
            <TabsContent value="financeiro">
              <OwnerFinanceiro 
                metrics={metrics} 
                stripeMetrics={stripeMetrics} 
                loading={metricsLoading} 
                stripeLoading={stripeLoading} 
              />
            </TabsContent>

            {/* Tab Operacional */}
            <TabsContent value="operacional">
              <OwnerOperacional metrics={metrics} loading={metricsLoading} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Dialogs */}
        <EditSubscriptionDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          user={selectedUser}
          onSuccess={handleSubscriptionUpdated}
        />

        <SubscriptionHistoryDialog
          open={historyDialogOpen}
          onOpenChange={setHistoryDialogOpen}
          subscriptionId={historySubscriptionId}
        />

        <TransferTokensDialog
          open={transferDialogOpen}
          onOpenChange={setTransferDialogOpen}
          targetUser={transferTargetUser}
          onSuccess={handleTransferSuccess}
        />
      </TooltipProvider>
    </div>
  );
};

export default Admin;
