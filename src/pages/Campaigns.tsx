import { DashboardSidebar } from "@/components/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Send, Users, Clock } from "lucide-react";

const Campaigns = () => {
  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      
      <main className="ml-64 p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Campanhas de Disparo</h1>
            <p className="text-muted-foreground">
              Crie e gerencie suas campanhas de mensagens em massa
            </p>
          </div>

          <Button size="lg">
            <Plus className="h-5 w-5 mr-2" />
            Nova Campanha
          </Button>
        </div>

        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-gradient-primary mb-6">
            <Send className="h-10 w-10 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Em breve!</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            A funcionalidade de disparos está sendo desenvolvida e estará disponível em breve.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Campaigns;
