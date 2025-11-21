import { DashboardSidebar } from "@/components/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";

const Contacts = () => {
  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      
      <main className="ml-64 p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Contatos</h1>
            <p className="text-muted-foreground">
              Gerencie sua base de contatos
            </p>
          </div>

          <Button size="lg">
            <Plus className="h-5 w-5 mr-2" />
            Importar Contatos
          </Button>
        </div>

        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-gradient-primary mb-6">
            <Users className="h-10 w-10 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Em breve!</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            O gerenciamento de contatos está sendo desenvolvido e estará disponível em breve.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Contacts;
