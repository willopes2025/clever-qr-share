import { Users, CreditCard, TrendingUp, Crown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PLANS } from "@/hooks/useSubscription";

interface AdminStatsCardsProps {
  totalUsers: number;
  activeSubscriptions: number;
  planCounts: Record<string, number>;
}

export const AdminStatsCards = ({ totalUsers, activeSubscriptions, planCounts }: AdminStatsCardsProps) => {
  // Calcular receita estimada
  const estimatedRevenue = Object.entries(planCounts).reduce((total, [plan, count]) => {
    const planConfig = PLANS[plan as keyof typeof PLANS];
    if (planConfig && plan !== 'free') {
      return total + (planConfig.price * count);
    }
    return total;
  }, 0);

  const stats = [
    {
      title: "Total de Usuários",
      value: totalUsers,
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    {
      title: "Assinaturas Ativas",
      value: activeSubscriptions,
      icon: CreditCard,
      color: "text-accent",
      bgColor: "bg-accent/10"
    },
    {
      title: "Receita Mensal",
      value: `R$ ${estimatedRevenue.toFixed(2)}`,
      icon: TrendingUp,
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    {
      title: "Planos Premium",
      value: (planCounts['profissional'] || 0) + (planCounts['agencia'] || 0) + (planCounts['avancado'] || 0),
      icon: Crown,
      color: "text-accent",
      bgColor: "bg-accent/10"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <Card key={index} className="depth-card hover:shadow-hover transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-2xl ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
