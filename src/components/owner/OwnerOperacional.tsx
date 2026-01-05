import { OwnerMetrics } from "@/hooks/useOwnerMetrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Smartphone, 
  Users, 
  MessageSquare, 
  Megaphone, 
  Zap, 
  CheckCircle,
  Activity 
} from "lucide-react";

interface Props {
  metrics: OwnerMetrics | null;
  loading: boolean;
}

const OwnerOperacional = ({ metrics, loading }: Props) => {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  const operationalKpis = [
    {
      title: "Instâncias WhatsApp",
      value: `${metrics.connectedInstances}/${metrics.totalInstances}`,
      icon: Smartphone,
      description: "Conectadas / Total",
      status: metrics.connectedInstances === metrics.totalInstances ? 'good' : 'warning',
    },
    {
      title: "Total Contatos",
      value: metrics.totalContacts.toLocaleString('pt-BR'),
      icon: Users,
      description: "Na base de dados",
      status: 'good',
    },
    {
      title: "Conversas",
      value: metrics.totalConversations.toLocaleString('pt-BR'),
      icon: MessageSquare,
      description: "Total de conversas",
      status: 'good',
    },
    {
      title: "Campanhas Ativas",
      value: metrics.activeCampaigns.toString(),
      icon: Megaphone,
      description: "Em execução",
      status: metrics.activeCampaigns > 0 ? 'good' : 'neutral',
    },
    {
      title: "Automações Ativas",
      value: metrics.activeAutomations.toString(),
      icon: Zap,
      description: "Configuradas e ativas",
      status: metrics.activeAutomations > 0 ? 'good' : 'neutral',
    },
    {
      title: "Msgs Enviadas Hoje",
      value: metrics.messagesSentToday.toString(),
      icon: CheckCircle,
      description: "Últimas 24h",
      status: 'neutral',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'error': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Operational KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {operationalKpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <kpi.icon className={`h-5 w-5 ${getStatusColor(kpi.status)}`} />
                <span className="text-sm font-medium text-muted-foreground">{kpi.title}</span>
              </div>
              <p className="text-3xl font-bold mt-2">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Instance Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Status das Instâncias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Taxa de Conexão</span>
                <span className="font-bold">
                  {metrics.totalInstances > 0 
                    ? `${((metrics.connectedInstances / metrics.totalInstances) * 100).toFixed(0)}%`
                    : '0%'
                  }
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div 
                  className="bg-green-500 h-3 rounded-full transition-all"
                  style={{ 
                    width: metrics.totalInstances > 0 
                      ? `${(metrics.connectedInstances / metrics.totalInstances) * 100}%`
                      : '0%'
                  }}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="rounded-lg border p-3 text-center">
                  <div className="w-3 h-3 rounded-full bg-green-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold">{metrics.connectedInstances}</p>
                  <p className="text-xs text-muted-foreground">Conectadas</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="w-3 h-3 rounded-full bg-muted-foreground mx-auto mb-2" />
                  <p className="text-2xl font-bold">{metrics.totalInstances - metrics.connectedInstances}</p>
                  <p className="text-xs text-muted-foreground">Desconectadas</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Média por Usuário Pagante</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Instâncias</span>
                  <span className="font-medium">
                    {metrics.payingUsers > 0 
                      ? (metrics.totalInstances / metrics.payingUsers).toFixed(1)
                      : '0'
                    }
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Contatos</span>
                  <span className="font-medium">
                    {metrics.payingUsers > 0 
                      ? Math.round(metrics.totalContacts / metrics.payingUsers).toLocaleString('pt-BR')
                      : '0'
                    }
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Conversas</span>
                  <span className="font-medium">
                    {metrics.payingUsers > 0 
                      ? Math.round(metrics.totalConversations / metrics.payingUsers).toLocaleString('pt-BR')
                      : '0'
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature Usage */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Uso de Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Campanhas</span>
                </div>
                <span className="text-sm font-medium">{metrics.activeCampaigns} ativas</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Automações</span>
                </div>
                <span className="text-sm font-medium">{metrics.activeAutomations} ativas</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Conversas/Contato</span>
                </div>
                <span className="text-sm font-medium">
                  {metrics.totalContacts > 0 
                    ? (metrics.totalConversations / metrics.totalContacts).toFixed(2)
                    : '0'
                  }
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Health Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <div className="relative inline-flex items-center justify-center">
                <Activity className="h-16 w-16 text-green-500" />
              </div>
              <p className="text-3xl font-bold mt-4 text-green-500">Saudável</p>
              <p className="text-sm text-muted-foreground mt-2">
                {metrics.connectedInstances}/{metrics.totalInstances} instâncias conectadas
              </p>
              <p className="text-sm text-muted-foreground">
                {metrics.churnRate.toFixed(1)}% churn rate
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OwnerOperacional;
