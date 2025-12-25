import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, Users, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminStatsCards } from "@/components/admin/AdminStatsCards";
import { UserSubscriptionsTable } from "@/components/admin/UserSubscriptionsTable";
import { EditSubscriptionDialog } from "@/components/admin/EditSubscriptionDialog";
import { SubscriptionHistoryDialog } from "@/components/admin/SubscriptionHistoryDialog";

interface UserWithSubscription {
  id: string;
  email: string;
  created_at: string;
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
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { user } = useAuth();
  const [users, setUsers] = useState<UserWithSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserWithSubscription | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historySubscriptionId, setHistorySubscriptionId] = useState<string | null>(null);

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
    <DashboardLayout className="p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-medium">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Painel Administrativo
              </h1>
              <p className="text-muted-foreground">
                Gerencie assinaturas e usuários do sistema
              </p>
            </div>
          </div>
          <Button onClick={fetchUsers} variant="outline" className="gap-2 rounded-xl">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Stats Cards */}
        <AdminStatsCards
          totalUsers={totalUsers}
          activeSubscriptions={activeSubscriptions}
          planCounts={planCounts}
        />

        {/* Users Table */}
        <Card className="depth-card">
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
              deletingUserId={deletingUserId}
            />
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <EditSubscriptionDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        user={selectedUser}
        onSuccess={handleSubscriptionUpdated}
      />

      {/* History Dialog */}
      <SubscriptionHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        subscriptionId={historySubscriptionId}
      />
    </DashboardLayout>
  );
};

export default Admin;