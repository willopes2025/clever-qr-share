import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, LayoutDashboard, DollarSign, Users, Activity } from "lucide-react";
import { useOwnerMetrics } from "@/hooks/useOwnerMetrics";
import { useAdmin } from "@/hooks/useAdmin";
import { Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import OwnerOverview from "@/components/owner/OwnerOverview";
import OwnerFinanceiro from "@/components/owner/OwnerFinanceiro";
import OwnerUsuarios from "@/components/owner/OwnerUsuarios";
import OwnerOperacional from "@/components/owner/OwnerOperacional";

const Owner = () => {
  const navigate = useNavigate();
  const { metrics, loading, error, refetch } = useOwnerMetrics();
  const { isAdmin, loading: adminLoading } = useAdmin();

  if (adminLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Verificando permissões...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <DashboardLayout className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Painel Owner</h1>
              <p className="text-sm text-muted-foreground">Dashboard Executivo SaaS</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refetch}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </header>

        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
            {error}
          </div>
        )}

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="overview" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="financeiro" className="gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Financeiro</span>
            </TabsTrigger>
            <TabsTrigger value="usuarios" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Usuários</span>
            </TabsTrigger>
            <TabsTrigger value="operacional" className="gap-2">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Operacional</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OwnerOverview metrics={metrics} loading={loading} />
          </TabsContent>

          <TabsContent value="financeiro">
            <OwnerFinanceiro metrics={metrics} loading={loading} />
          </TabsContent>

          <TabsContent value="usuarios">
            <OwnerUsuarios metrics={metrics} loading={loading} />
          </TabsContent>

          <TabsContent value="operacional">
            <OwnerOperacional metrics={metrics} loading={loading} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Owner;
