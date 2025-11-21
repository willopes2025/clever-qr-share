import { DashboardSidebar } from "@/components/DashboardSidebar";
import { Card } from "@/components/ui/card";
import { MessageSquare, QrCode, Send, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

const stats = [
  {
    icon: QrCode,
    label: "Instâncias Ativas",
    value: "3",
    change: "+2 este mês",
    color: "text-whatsapp"
  },
  {
    icon: MessageSquare,
    label: "Mensagens Enviadas",
    value: "1,234",
    change: "+180 hoje",
    color: "text-primary"
  },
  {
    icon: Send,
    label: "Campanhas Ativas",
    value: "5",
    change: "2 em andamento",
    color: "text-accent"
  },
  {
    icon: TrendingUp,
    label: "Taxa de Entrega",
    value: "98.5%",
    change: "+2.3% vs. semana passada",
    color: "text-whatsapp"
  }
];

const Dashboard = () => {
  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      
      <main className="ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Bem-vindo de volta! Aqui está um resumo das suas atividades.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card className="p-6 shadow-medium hover:shadow-large transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className={`h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center`}>
                    <stat.icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold mb-1">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.change}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="p-6 shadow-medium">
            <h3 className="text-xl font-semibold mb-4">Atividade Recente</h3>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((_, index) => (
                <div key={index} className="flex items-start gap-3 pb-4 border-b border-border last:border-0 last:pb-0">
                  <div className="h-2 w-2 rounded-full bg-whatsapp mt-2" />
                  <div className="flex-1">
                    <p className="font-medium mb-1">Nova mensagem enviada</p>
                    <p className="text-sm text-muted-foreground">
                      Campanha "Promoção Black Friday" - há {index + 1} minutos
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 shadow-medium">
            <h3 className="text-xl font-semibold mb-4">Próximas Campanhas</h3>
            <div className="space-y-4">
              {[1, 2, 3].map((_, index) => (
                <div key={index} className="flex items-start gap-3 pb-4 border-b border-border last:border-0 last:pb-0">
                  <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                    <Send className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium mb-1">Campanha {index + 1}</p>
                    <p className="text-sm text-muted-foreground">
                      Programada para amanhã às 10:00
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
